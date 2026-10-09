import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=v=>createHash('sha256').update(v).digest('hex');
const keys=new Set(['mydomAddress','mydomAccounts','mydomManualBills','mydomResidentIssues','mydomWater','mydomMeterHistory','mydomApartmentsV1','mydomWelcomeDone','mydomHouseEvents']);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function createApp({database=process.env.DATABASE_PATH||'/data/mydom.sqlite',origin=process.env.APP_ORIGIN||'http://localhost:8080',invite=process.env.REGISTRATION_CODE||'',allowLocalRegistration=false,outagesPath=process.env.OUTAGES_PATH||''}={}){
 const url=new URL(origin);if(url.origin!==origin)throw Error('APP_ORIGIN must be an origin without a path');
 const local=['localhost','127.0.0.1'].includes(url.hostname);if(!local&&url.protocol!=='https:')throw Error('Production requires HTTPS APP_ORIGIN');
 if(database!==':memory:')mkdirSync(dirname(database),{recursive:true});
 const db=new DatabaseSync(database);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,login TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS documents(user_id INTEGER PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL DEFAULT 0,data TEXT,updated TEXT);
 CREATE TABLE IF NOT EXISTS versions(user_id INTEGER NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(user_id,revision));`);
 const attempts=new Map();
 function limit(ip){const now=Date.now();for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);let x=attempts.get(ip)||{count:0,until:now+15*60000};x.count++;attempts.set(ip,x);if(x.count>30)fail(429,'Слишком много попыток. Повторите через 15 минут.');}
 function user(req){const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mydom_session='));if(!cookie)fail(401,'Войдите в учётную запись.');const token=cookie.slice(14);const row=db.prepare('SELECT users.id,users.login FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(hash(token),Date.now());if(!row)fail(401,'Сессия завершена. Войдите снова.');return row;}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Требуется JSON');let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>2*1024*1024)fail(413,'Превышен лимит 2 МБ');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch(e){fail(400,'Некорректный JSON');}}
 const server=http.createServer(async(req,res)=>{
  const send=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));};
  try{
   const path=new URL(req.url,origin).pathname;
   if(path.startsWith('/api/')){
    if(req.method!=='GET'&&req.headers.origin!==origin)fail(403,'Недопустимый источник запроса.');
    if(path==='/api/health'&&req.method==='GET')return send(200,{service:'mydom',storage:'sqlite'});
    if(['/api/register','/api/login'].includes(path)&&req.method==='POST'){
     limit(req.socket.remoteAddress);const b=await body(req);const login=String(b.login||'').trim().toLowerCase(),password=String(b.password||'');
     if(!/^[a-z0-9_.@+-]{3,100}$/.test(login)||password.length<12||password.length>200)fail(400,'Логин: 3–100 латинских символов. Пароль: 12–200 символов.');
     let row;
     if(path==='/api/register'){
      if(!(local&&allowLocalRegistration)&&(!invite||String(b.invite||'')!==invite))fail(403,'Для регистрации нужен код приглашения.');
      const salt=randomBytes(16).toString('hex'),passwordHash=scryptSync(password,salt,64).toString('hex');
      try{const created=db.prepare('INSERT INTO users(login,salt,password) VALUES(?,?,?)').run(login,salt,passwordHash);row={id:Number(created.lastInsertRowid),login};db.prepare('INSERT INTO documents(user_id) VALUES(?)').run(row.id);}catch(e){if(e.code?.includes('SQLITE'))fail(409,'Этот логин недоступен.');throw e;}
     }else{
      row=db.prepare('SELECT * FROM users WHERE login=?').get(login);const computed=scryptSync(password,row?.salt||'0000000000000000',64);if(!row||!timingSafeEqual(computed,Buffer.from(row.password,'hex')))fail(401,'Неверный логин или пароль.');
     }
     const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),row.id,Date.now()+7*86400000);
     return send(200,{login:row.login},{'Set-Cookie':`mydom_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${local?'':'; Secure'}`});
    }
    if(path==='/api/outages'&&req.method==='GET'){
     if(!outagesPath)return send(503,{error:'Сбор объявлений ещё не настроен'});
     try{const feed=JSON.parse(readFileSync(outagesPath,'utf8'));if(feed.schemaVersion!==1||!Array.isArray(feed.events))throw Error('invalid');return send(200,feed);}catch(e){return send(503,{error:'Файл объявлений пока недоступен'});}
    }
    const account=user(req);
    if(path==='/api/session'&&req.method==='GET')return send(200,{login:account.login});
    if(path==='/api/logout'&&req.method==='POST'){const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mydom_session='));db.prepare('DELETE FROM sessions WHERE token=?').run(hash(cookie.slice(14)));return send(200,{ok:true},{'Set-Cookie':'mydom_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(local?'':'; Secure')});}
    if(path==='/api/data'&&req.method==='GET'){const d=db.prepare('SELECT * FROM documents WHERE user_id=?').get(account.id);return send(200,{revision:d.revision,data:d.data?JSON.parse(d.data):null,updated:d.updated});}
    if(path==='/api/data'&&req.method==='PUT'){
     const b=await body(req);if(!Number.isSafeInteger(b.revision)||b.revision<0||!b.data||Array.isArray(b.data)||typeof b.data!=='object')fail(400,'Неверный формат данных');
     for(const [k,v]of Object.entries(b.data)){if(!keys.has(k)||(v!==null&&typeof v!=='string'))fail(400,'Недопустимое поле');if(v!==null&&!['mydomWater','mydomWelcomeDone'].includes(k)){try{JSON.parse(v);}catch(e){fail(400,'Некорректные данные квартиры');}}}
     const data=JSON.stringify(b.data),updated=new Date().toISOString();db.exec('BEGIN IMMEDIATE');try{
      const current=db.prepare('SELECT * FROM documents WHERE user_id=?').get(account.id);if(current.revision!==b.revision){db.exec('ROLLBACK');return send(409,{error:'На сервере более новая версия. Загрузите её перед сохранением.'});}
      if(current.data)db.prepare('INSERT INTO versions VALUES(?,?,?,?)').run(account.id,current.revision,current.data,updated);
      db.prepare('UPDATE documents SET data=?,revision=revision+1,updated=? WHERE user_id=?').run(data,updated,account.id);
      db.prepare('DELETE FROM versions WHERE user_id=? AND revision < ?').run(account.id,current.revision-9);db.exec('COMMIT');return send(200,{revision:current.revision+1,updated});
     }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}
    }
    fail(404,'Маршрут не найден');
   }
   if(!['GET','HEAD'].includes(req.method))fail(405,'Метод не поддерживается');
   const name=path==='/'?'index.html':path.slice(1);const publicFile=/^(index\.html|[a-zA-Z0-9_-]+\.(js|css|png)|manifest\.webmanifest|vendor\/[a-zA-Z0-9_.-]+\.(js|wasm))$/.test(name);if(!publicFile)fail(404,'Не найдено');
   let data;try{data=readFileSync(resolve(root,name));}catch(e){fail(404,'Не найдено');}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'Внутренняя ошибка сервера'});else res.end();}
 });
 server.on('close',()=>db.close());return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=createApp();server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('MyDom server listening'));}
