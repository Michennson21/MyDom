import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from './server.mjs';
const origin='http://localhost:8080';
async function start(database=':memory:'){const server=createApp({database,origin,invite:'test-invitation'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const request=async(path,{method='GET',cookie='',data,requestOrigin=origin}={})=>{const r=await fetch(base+'/api/'+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',Cookie:cookie},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};};return {server,base,request,close:()=>new Promise(r=>server.close(r))};}
const credentials=login=>({login,password:'test-password-12345',invite:'test-invitation'});
test('authentication, user isolation, conflict, CSRF, logout and non-cacheable data',async()=>{const app=await start();try{
 assert.equal((await app.request('data')).status,401);
 assert.equal((await app.request('register',{method:'POST',data:{...credentials('bad'),invite:'wrong'}})).status,403);
 const a=await app.request('register',{method:'POST',data:credentials('user-a')});assert.equal(a.status,200);assert.match(a.headers.get('set-cookie'),/HttpOnly/);assert.match(a.headers.get('set-cookie'),/SameSite=Strict/);
 const b=await app.request('register',{method:'POST',data:credentials('user-b')});assert.equal(b.status,200);
 assert.equal((await app.request('login',{method:'POST',data:{...credentials('user-a'),password:'wrong-password-999'}})).status,401);
 const payload={revision:0,data:{mydomAccounts:'[{"provider":"Водоканал","number":"00001"}]'}};
 assert.equal((await app.request('data',{method:'PUT',cookie:a.cookie,data:payload,requestOrigin:'https://evil.example'})).status,403);
 assert.equal((await app.request('data',{method:'PUT',cookie:a.cookie,data:payload})).status,200);
 assert.equal((await app.request('data',{method:'PUT',cookie:a.cookie,data:payload})).status,409);
 const privateData=await app.request('data',{cookie:a.cookie});assert.equal(privateData.body.revision,1);assert.equal(privateData.headers.get('cache-control'),'no-store');
 assert.equal((await app.request('data',{cookie:b.cookie})).body.data,null);
 assert.equal((await app.request('data',{method:'PUT',cookie:a.cookie,data:{revision:1,data:{secret:'invalid'}}})).status,400);
 assert.equal((await fetch(app.base+'/server/server.mjs')).status,404);
 assert.equal((await app.request('logout',{method:'POST',cookie:a.cookie,data:{}})).status,200);assert.equal((await app.request('data',{cookie:a.cookie})).status,401);
 }finally{await app.close();}});
test('database survives process restart',async()=>{const dir=mkdtempSync(join(tmpdir(),'mydom-api-')),database=join(dir,'db.sqlite');let app=await start(database);try{const a=await app.request('register',{method:'POST',data:credentials('persist')});await app.request('data',{method:'PUT',cookie:a.cookie,data:{revision:0,data:{mydomWater:'123'}}});await app.close();app=await start(database);const session=await app.request('login',{method:'POST',data:credentials('persist')});assert.equal((await app.request('data',{cookie:session.cookie})).body.data.mydomWater,'123');}finally{await app.close();rmSync(dir,{recursive:true,force:true});}});
