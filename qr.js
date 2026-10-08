/* QR receipts: local decoding; no image upload and no payment initiation. */
'use strict';
function parseReceiptQR(text) {
  const raw=String(text||'').trim();
  if (/^https?:\/\//i.test(raw)) throw new Error('В QR-коде ссылка, а не реквизиты квитанции. Автоматическое заполнение для таких кодов пока недоступно. Введите начисление вручную.');
  if (!/^ST0001[12]\|/.test(raw)) throw new Error('Это не поддерживаемый QR-код квитанции. Используйте код с платёжными реквизитами (ST00011 или ST00012).');
  const fields=Object.create(null);
  for (const part of raw.split('|').slice(1)) {
    if (!part) continue;
    const split=part.indexOf('=');
    if(split<1) throw new Error('В QR-коде повреждено поле реквизитов. Попробуйте другое фото.');
    const key=part.slice(0,split).trim().toLowerCase(), value=part.slice(split+1).trim();
    if(Object.hasOwn(fields,key) && fields[key]!==value) throw new Error('В QR-коде противоречивые реквизиты. Введите данные вручную.');
    fields[key]=value;
  }
  if(!fields.name) throw new Error('В QR-коде не указан получатель. Введите данные вручную.');
  let total='';
  if(fields.sum!==undefined && fields.sum!=='') {
    if(!/^\d+$/.test(fields.sum) || !Number.isSafeInteger(Number(fields.sum))) throw new Error('Некорректная сумма в QR-коде. Введите данные вручную.');
    total=(Number(fields.sum)/100).toFixed(2);
  }
  // PersonalAcc is the recipient's BANK account, never the resident's account.
  return {raw, fields, recipient:fields.name, account:fields.persacc||'', period:fields.paymperiod||'', total, address:fields.payeraddress||'', purpose:fields.purpose||''};
}
function receiptQRText(code) {
  const bytes=Uint8Array.from(code.binaryData||[]);
  const header=String.fromCharCode(...bytes.slice(0,7));
  if(header==='ST00011') return new TextDecoder('windows-1251',{fatal:true}).decode(bytes);
  if(header==='ST00012') return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  return code.data||'';
}
let qrStream=null, qrTimer=null, qrRun=0, qrDraft=null, qrPhotoRun=0;
const qrEl=id=>document.getElementById(id);
function qrStatus(message){qrEl('qrStatus').textContent=message;}
function openQR(){stopQRCamera();qrPhotoRun++;qrDraft=null;qrEl('qrResult').replaceChildren();qrStatus('Выберите камеру или фото QR-кода.');qrEl('qrModal').classList.add('show');}
function closeQR(){stopQRCamera();qrPhotoRun++;qrDraft=null;qrEl('qrModal').classList.remove('show');}
function stopQRCamera(){
  qrRun++; clearTimeout(qrTimer);qrTimer=null;
  if(qrStream) qrStream.getTracks().forEach(t=>t.stop());
  qrStream=null; const video=qrEl('qrVideo');video.pause();video.srcObject=null;video.style.display='none';
  qrEl('qrStop').style.display='none';qrEl('qrCamera').disabled=false;
}
function decodeQRImage(source,width,height){
  if(typeof jsQR!=='function') throw new Error('Модуль QR не загрузился. Обновите приложение с подключённым интернетом.');
  const scale=Math.min(1,2000/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(data.data,data.width,data.height,{inversionAttempts:'attemptBoth'});
}
async function startQRCamera(){
  stopQRCamera();qrPhotoRun++;qrDraft=null;qrEl('qrResult').replaceChildren();
  if(!navigator.mediaDevices?.getUserMedia){qrStatus('Камера недоступна в этом браузере. Выберите фото QR-кода.');return;}
  const run=qrRun;qrEl('qrCamera').disabled=true;qrStatus('Разрешите доступ к камере.');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(run!==qrRun){stream.getTracks().forEach(t=>t.stop());return;}
    qrStream=stream;const video=qrEl('qrVideo');video.srcObject=stream;video.style.display='block';qrEl('qrStop').style.display='block';
    await video.play();if(run!==qrRun)return;qrStatus('Держите один QR-код в кадре, крупно и без бликов.');
    const scan=()=>{
      if(run!==qrRun)return;
      try{if(video.readyState>=2 && video.videoWidth){const code=decodeQRImage(video,video.videoWidth,video.videoHeight);if(code){stopQRCamera();showQRResult(code);return;}}}
      catch(error){stopQRCamera();qrStatus(error.message);return;}
      qrTimer=setTimeout(scan,300);
    };scan();
  }catch(error){if(run!==qrRun)return;stopQRCamera();qrStatus('Не удалось открыть камеру. Разрешите доступ в настройках браузера или выберите фото.');}
}
async function readQRPhoto(file){
  if(!file)return;stopQRCamera();const run=++qrPhotoRun;qrDraft=null;qrEl('qrResult').replaceChildren();
  if(file.size>20*1024*1024){qrStatus('Фото слишком большое. Выберите изображение до 20 МБ.');return;}
  if(file.type && !file.type.startsWith('image/')){qrStatus('Выберите изображение QR-кода (например, JPG или PNG).');return;}
  qrStatus('Читаю QR-код…');const url=URL.createObjectURL(file);
  try{
    const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
    if(run!==qrPhotoRun)return;
    const code=decodeQRImage(img,img.naturalWidth,img.naturalHeight);
    if(!code){qrStatus('QR-код не найден. Сфотографируйте только код крупным планом, без бликов и размытия.');return;}
    showQRResult(code);
  }catch(error){if(run===qrPhotoRun)qrStatus(error.message||'Не удалось прочитать фото. Попробуйте JPG или PNG.');}
  finally{URL.revokeObjectURL(url);}
}
function showQRResult(code){
  try{qrDraft=parseReceiptQR(receiptQRText(code));}catch(error){qrDraft=null;qrStatus(error.message);return;}
  qrStatus('QR-код прочитан. Проверьте данные перед сохранением.');
  const x=qrDraft;
  const currentAddress=savedAddress?`${savedAddress.street}, д. ${savedAddress.house}, кв. ${savedAddress.apartment}`:'Адрес в приложении не выбран';
  const providers=[...qrEl('billProvider').options].map(o=>o.value);
  const details=[['Получатель',x.recipient],['ИНН',x.fields.payeeinn],['Расчётный счёт получателя',x.fields.personalacc],['Банк',x.fields.bankname],['БИК',x.fields.bic],['Адрес в QR',x.address],['Назначение',x.purpose]];
  qrEl('qrResult').innerHTML=`<div class="notice" style="margin-top:12px">Сохранение добавит начисление. Оплата и отправка поставщику не выполняются.</div>${details.filter(([,v])=>v).map(([k,v])=>`<div class="field"><b>${k}</b><span style="overflow-wrap:anywhere">${escapeHtml(v)}</span></div>`).join('')}<p class="muted">Ваш адрес: ${escapeHtml(currentAddress)}</p><label class="formlabel" for="qrProvider">Услуга / поставщик *</label><select id="qrProvider" class="input"><option value="">Выберите, к какой услуге относится квитанция</option>${providers.map(p=>`<option>${escapeHtml(p)}</option>`).join('')}</select><label class="formlabel" for="qrAccount">Лицевой счёт *</label><input id="qrAccount" class="input" value="${escapeHtml(x.account)}" placeholder="Нет в QR — введите вручную"><label class="formlabel" for="qrPeriod">Период *</label><input id="qrPeriod" class="input" value="${escapeHtml(x.period)}" placeholder="Нет в QR — например, 09.2026"><label class="formlabel" for="qrTotal">К оплате, ₽ *</label><input id="qrTotal" class="input" inputmode="decimal" value="${escapeHtml(x.total.replace('.',','))}" placeholder="Нет в QR — введите вручную"><label style="display:flex;gap:8px;margin-top:14px;font-size:13px"><input type="checkbox" id="qrConfirmed">Я сверил получателя, адрес, лицевой счёт, период и сумму с квитанцией</label><button id="qrSave" class="btn block" onclick="saveQRBill()">Сохранить начисление</button>`;
}
function saveQRBill(){
  if(!qrDraft)return;
  const provider=qrEl('qrProvider').value,account=qrEl('qrAccount').value.trim(),period=qrEl('qrPeriod').value.trim();
  const totalText=qrEl('qrTotal').value.replace(/\s/g,'').replace(',','.');
  if(!provider||!account||!period){qrStatus('Выберите услугу, укажите лицевой счёт и период.');return;}
  if(!/^\d+(\.\d{1,2})?$/.test(totalText)||!Number.isSafeInteger(Math.round(Number(totalText)*100))){qrStatus('Введите сумму в рублях: например, 1250,50.');return;}
  if(!qrEl('qrConfirmed').checked){qrStatus('Сверьте данные с квитанцией и отметьте подтверждение.');return;}
  const periodKey=v=>String(v).toLowerCase().replace(/\s+/g,' ').trim();
  if(manualBills.some(b=>b.qrRaw===qrDraft.raw || (b.provider===provider && b.account===account && periodKey(b.period)===periodKey(period)))){qrStatus('Это начисление уже есть. Откройте «Начисления» и при необходимости измените существующую запись.');return;}
  const newAccounts=accounts.some(a=>a.provider===provider&&a.number===account)?accounts:[...accounts,{provider,number:account,icon:icons[provider]||'🏠'}];
  const record={id:Date.now(),provider,account,period,total:Number(totalText),accrued:0,debt:0,paid:0,paidDate:'',source:'qr',qrRaw:qrDraft.raw,qrFields:{...qrDraft.fields},address:qrDraft.address,createdAt:new Date().toISOString()};
  const newBills=[record,...manualBills];
  // Roll back both keys on storage failure, preserving the current in-memory state.
  const oldAccounts=localStorage.getItem('mydomAccounts'),oldBills=localStorage.getItem('mydomManualBills');
  try{localStorage.setItem('mydomAccounts',JSON.stringify(newAccounts));localStorage.setItem('mydomManualBills',JSON.stringify(newBills));}
  catch(error){try{for(const [k,v] of [['mydomAccounts',oldAccounts],['mydomManualBills',oldBills]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}catch(_){}qrStatus('Не удалось сохранить данные в браузере. Освободите место и повторите.');return;}
  accounts=newAccounts;manualBills=newBills;closeQR();renderAll();go('bills');
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopQRCamera();});
  window.addEventListener('pagehide',stopQRCamera);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&qrEl('qrModal').classList.contains('show'))closeQR();});
}
if(typeof module!=='undefined' && module.exports)module.exports={parseReceiptQR,receiptQRText};
