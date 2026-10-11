/* Recover and validate storage before application scripts read user data. */
(async()=>{
 const app=document.querySelector('.app');app.inert=true;
 function recovery(error){
  app.hidden=true;const panel=document.createElement('main');panel.className='card';panel.style.cssText='max-width:600px;margin:30px auto';document.body.append(panel);
  const title=document.createElement('h2');title.textContent='Данные требуют восстановления';panel.append(title);
  const p=document.createElement('p');p.textContent=error.message+' Ничего не удалено. Сначала скачайте исходные данные.';panel.append(p);
  const download=document.createElement('button');download.className='btn';download.textContent='Скачать исходные данные';download.onclick=()=>{const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('mydom'))data[k]=localStorage.getItem(k);}const url=URL.createObjectURL(new Blob([JSON.stringify({format:'mydom-recovery',data},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mydom-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};panel.append(download);
  const label=document.createElement('label');label.textContent='Восстановить из резервной копии: ';const input=document.createElement('input');input.type='file';input.accept='.json,application/json';label.append(input);panel.append(label);input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>2*1024*1024)throw Error('Файл больше 2 МБ');const data=BackupSchema.backup(JSON.parse(await f.text()));if(!confirm('Заменить данные проверенной копией? Исходные данные сохранятся в резервной записи.'))return;await SafeStore.replace(data);location.reload();}catch(e){p.textContent=e.message;}finally{input.value='';}};
  const reload=document.createElement('button');reload.className='btn secondary';reload.textContent='Повторить загрузку';reload.onclick=()=>location.reload();panel.append(reload);
 }
 try{if(!window.MeterValues)throw Error('Не удалось загрузить модуль показаний. Повторите загрузку.');if(!window.Billing)throw Error('Не удалось загрузить модуль начислений. Проверьте соединение и повторите загрузку.');await SafeStore.init();}catch(e){recovery(e);return;}
 for(const original of document.querySelectorAll('script[data-app-core]')){const script=document.createElement('script');script.textContent=original.textContent;document.body.append(script);}
 app.inert=false;
 for(const src of ['vendor/jsQR-1.4.0.js','vendor/zxing-0.21.3.min.js','vendor/zxing-wasm-3.1.5.js','qr.js','welcome.js']){
  try{await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});}catch(e){console.error('Не удалось загрузить '+src);}
 }
})();
