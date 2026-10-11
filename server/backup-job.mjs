import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createBackup} from './backup.mjs';
try{const {DATABASE_PATH,BACKUP_DIRECTORY,BACKUP_KEY_FILE}=process.env;if(!DATABASE_PATH||!BACKUP_DIRECTORY||!BACKUP_KEY_FILE)throw Error('DATABASE_PATH, BACKUP_DIRECTORY and BACKUP_KEY_FILE required');mkdirSync(BACKUP_DIRECTORY,{recursive:true,mode:0o700});const name='mydom-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(4).toString('hex')+'.enc';await createBackup(DATABASE_PATH,join(BACKUP_DIRECTORY,name),BACKUP_KEY_FILE);console.log('Encrypted backup verified and saved:',name);}catch(e){console.error('Backup job failed:',e.message);process.exitCode=1;}
