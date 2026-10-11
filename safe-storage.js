/* All writers share one Web Lock. Multi-key writes use a durable undo journal. */
(function(){
 const S=BackupSchema,JOURNAL='mydomPendingWriteV1',BACKUP='mydomBeforeCloudRestore';
 const keys=[...S.keys,BACKUP];let baseline=null,blocked=false;
 const snapshot=()=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
 const same=(a,b)=>keys.every(k=>a[k]===b[k]);
 function notice(message){let box=document.getElementById('storageNotice');if(!box){box=document.createElement('div');box.id='storageNotice';box.className='notice';box.setAttribute('role','alert');document.querySelector('.content').prepend(box);}box.replaceChildren();const p=document.createElement('p');p.textContent=message;box.append(p);const b=document.createElement('button');b.className='btn secondary';b.textContent='Обновить данные';b.onclick=()=>location.reload();box.append(b);}
 const conflict=()=>{notice('Данные изменены в другой вкладке. Запись остановлена, чтобы ничего не затереть. Скопируйте незавершённый текст, затем обновите данные.');return Error('Данные изменены в другой вкладке. Обновите данные перед сохранением.');};
 function apply(data){for(const [k,v]of Object.entries(data)){if(localStorage.getItem(k)===v)continue;if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}
 function recover(){const raw=localStorage.getItem(JOURNAL);if(!raw)return;const j=JSON.parse(raw);if(!j||j.version!==1||!j.before||Object.keys(j.before).some(k=>!keys.includes(k))||Object.values(j.before).some(v=>v!==null&&typeof v!=='string'))throw Error('Не удалось прочитать журнал восстановления.');apply(j.before);localStorage.removeItem(JOURNAL);}
 async function init(){if(!navigator.locks)throw Error('Этот браузер не поддерживает безопасную запись. Откройте приложение в обновлённом браузере.');await navigator.locks.request('mydom-write-v1',()=>{recover();baseline=snapshot();S.validate(Object.fromEntries(S.keys.map(k=>[k,baseline[k]])));});}
 async function commit(patch,{backup=false}={}){
  if(blocked)throw Error('Запись заблокирована до восстановления данных.');
  const expected=baseline;return navigator.locks.request('mydom-write-v1',()=>{
   if(localStorage.getItem(JOURNAL)){blocked=true;throw Error('Незавершённая запись. Перезагрузите приложение для восстановления.');}
   const current=snapshot();if(!same(current,expected))throw conflict();
   if(Object.keys(patch).some(k=>!S.keys.includes(k))||Object.values(patch).some(v=>v!==null&&typeof v!=='string'))throw Error('Неверный формат записи.');
   S.validate({...Object.fromEntries(S.keys.map(k=>[k,current[k]])),...patch});
   const changes={...patch};if(backup)changes[BACKUP]=JSON.stringify({createdAt:new Date().toISOString(),data:Object.fromEntries(S.keys.map(k=>[k,current[k]]))});
   const before=Object.fromEntries(Object.keys(changes).map(k=>[k,current[k]]));
   localStorage.setItem(JOURNAL,JSON.stringify({version:1,before}));
   try{apply(changes);localStorage.removeItem(JOURNAL);}
   catch(e){try{apply(before);localStorage.removeItem(JOURNAL);}catch(_){blocked=true;notice('Запись прервана. Перезагрузите приложение: прежние данные сохранены в журнале восстановления.');}throw Error('Не удалось сохранить данные. Введённые сведения оставлены в форме.');}
   baseline=snapshot();
  });
 }
 async function replace(data){S.validate(data);await commit(Object.fromEntries(S.keys.map(k=>[k,data[k]??null])),{backup:true});}
 async function save(patch){try{await commit(patch);return true;}catch(e){alert(e.message);return false;}}
 window.SafeStore={init,commit,replace,save,keys:S.keys,snapshot:()=>Object.fromEntries(S.keys.map(k=>[k,localStorage.getItem(k)]))};
 window.addEventListener('storage',e=>{if(baseline&&keys.includes(e.key)&&!same(snapshot(),baseline))conflict();});
})();
