import {DatabaseSync,backup} from 'node:sqlite';
import {resolve} from 'node:path';
if(!process.argv[2])throw Error('Usage: node server/backup.mjs /backup/destination.sqlite');
const source=resolve(process.env.DATABASE_PATH||'/data/mydom.sqlite'),destination=resolve(process.argv[2]);if(source===destination)throw Error('Backup destination must differ from database');
const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,destination);console.log('SQLite backup complete');}finally{db.close();}
