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
let qrWasmConfigured=false, qrCandidates=[];
async function readAllQRCodes(input){
  if(typeof ZXingWASM==='undefined')return [];
  if(!qrWasmConfigured){
    const wasmURL=new URL('./vendor/zxing-wasm-3.1.5.wasm',document.baseURI).href;
    ZXingWASM.prepareZXingModule({overrides:{locateFile:(path,prefix)=>path.endsWith('.wasm')?wasmURL:prefix+path}});
    qrWasmConfigured=true;
  }
  const results=await ZXingWASM.readBarcodes(input,{formats:['QRCode'],tryHarder:true,tryRotate:true,tryInvert:true,maxNumberOfSymbols:10});
  return results.filter(r=>r.isValid).map(r=>({data:r.text,binaryData:r.bytes}));
}
function isPaymentQR(code){try{return /^ST0001[12]\|/.test(receiptQRText(code).trim());}catch(error){return false;}}
function showQRResults(codes){
  const unique=new Map();
  for(const code of codes){if(!isPaymentQR(code))continue;try{const text=receiptQRText(code).trim();unique.set(text,{code,draft:parseReceiptQR(text)});}catch(error){/* An invalid code must not hide a valid one on the same page. */}}
  qrCandidates=[...unique.values()];
  if(qrCandidates.length===1){showQRResult(qrCandidates[0].code);return;}
  if(qrCandidates.length>1){showQRChoices();return;}
  if(codes.length){showQRResult(codes.find(isPaymentQR)||codes[0]);return;}
  qrStatus('Платёжный QR не найден. Выберите фото одного кода с белой рамкой вокруг него.');
}
function showQRChoices(){
  qrDraft=null;qrStatus(`Найдено платёжных QR: ${qrCandidates.length}. Выберите вариант по банку и реквизитам. Обычные ссылки пропущены.`);
  qrEl('qrResult').innerHTML='<div class="notice">На квитанции могут быть варианты для разных банков. Сохранение одного варианта добавит одно начисление.</div>';
  qrCandidates.forEach(({draft},index)=>{
    const button=document.createElement('button');button.className='mini';button.style.cssText='width:100%;text-align:left;margin-top:10px;overflow-wrap:anywhere';
    button.innerHTML=`<b>${escapeHtml(draft.recipient)}</b><div>${escapeHtml(draft.fields.bankname||'Банк не указан')}</div><div class="muted">Расчётный счёт: ${escapeHtml(draft.fields.personalacc||'не указан')}</div><div>Л/с ${escapeHtml(draft.account||'не указан')} · ${draft.total?escapeHtml(moneyRu(Number(draft.total))):'Сумма не указана'}</div>`;
    button.addEventListener('click',()=>showQRResult(qrCandidates[index].code));qrEl('qrResult').append(button);
  });
}

let qrStream=null, qrTimer=null, qrRun=0, qrDraft=null, qrPhotoRun=0;
const qrEl=id=>document.getElementById(id);
function qrStatus(message){qrEl('qrStatus').textContent=message;}
function openQR(){stopQRCamera();qrPhotoRun++;qrCandidates=[];qrDraft=null;qrEl('qrResult').replaceChildren();qrStatus('Выберите камеру или фото QR-кода.');qrEl('qrModal').classList.add('show');}
function closeQR(){stopQRCamera();qrPhotoRun++;qrCandidates=[];qrDraft=null;qrEl('qrModal').classList.remove('show');}
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
  return decodeQRPixels(data);
}
function decodeQRPixels(data, secondary=true){
  let result=jsQR(data.data,data.width,data.height,{inversionAttempts:'attemptBoth'});
  if(result || !secondary || typeof ZXing==='undefined')return result;
  // A second detector helps with dense or low-contrast printed QR symbols.
  const luminance=new Uint8ClampedArray(data.width*data.height);
  for(let p=0,i=0;p<luminance.length;p++,i+=4)luminance[p]=(data.data[i]+2*data.data[i+1]+data.data[i+2])/4;
  const source=new ZXing.RGBLuminanceSource(luminance,data.width,data.height);
  const hints=new Map([[ZXing.DecodeHintType.TRY_HARDER,true]]);
  const reader=new ZXing.QRCodeReader();
  for(const inverted of [false,true]){
    try{
      const bitmap=new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(inverted?source.invert():source));
      let decoded=reader.decode(bitmap,hints),text=decoded.getText();
      if(/^ST0001[12]/.test(text)){
        hints.set(ZXing.DecodeHintType.CHARACTER_SET,text.startsWith('ST00011')?'windows-1251':'UTF-8');
        decoded=reader.decode(bitmap,hints);text=decoded.getText();
      }
      return {data:text};
    }catch(error){/* Not found by this detector; try the next representation. */}
    finally{reader.reset();}
  }
  return null;
}
function qrPhotoRegions(width,height){
  const regions=[{x:0,y:0,w:width,h:height,max:1600},{x:0,y:0,w:width,h:height,max:900},{x:0,y:0,w:width,h:height,max:2600}];
  // Overlapping tiles preserve small symbols without allocating a full-size canvas.
  const tileW=Math.min(width,1600),tileH=Math.min(height,1600);
  const nx=Math.min(5,Math.max(1,Math.ceil((width-tileW)/(tileW*.65))+1));
  const ny=Math.min(5,Math.max(1,Math.ceil((height-tileH)/(tileH*.65))+1));
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)regions.push({x:Math.round(nx===1?0:x*(width-tileW)/(nx-1)),y:Math.round(ny===1?0:y*(height-tileH)/(ny-1)),w:tileW,h:tileH,max:1600});
  return regions;
}
async function decodeQRPhoto(source,width,height,isCurrent=()=>true){
  if(typeof jsQR!=='function')throw new Error('Модуль QR не загрузился. Обновите приложение с подключённым интернетом.');
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  const regions=qrPhotoRegions(width,height);let unsupported=null;
  for(let i=0;i<regions.length;i++){
    if(!isCurrent())return null;
    qrStatus(`Ищу QR-код на фото… ${i+1}/${regions.length}`);
    // Yield between passes so close/new photo actions can cancel this search.
    await new Promise(resolve=>setTimeout(resolve,0));
    if(!isCurrent())return null;
    const r=regions[i],scale=Math.min(2,r.max/Math.max(r.w,r.h)),padding=32;
    const w=Math.max(1,Math.round(r.w*scale)),h=Math.max(1,Math.round(r.h*scale));
    canvas.width=w+padding*2;canvas.height=h+padding*2;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=scale<1;
    ctx.drawImage(source,r.x,r.y,r.w,r.h,padding,padding,w,h);
    const result=decodeQRPixels(ctx.getImageData(0,0,canvas.width,canvas.height));
    if(result){if(isPaymentQR(result))return result;unsupported??=result;}
  }
  return unsupported;
}

async function startQRCamera(){
  stopQRCamera();qrPhotoRun++;qrCandidates=[];qrDraft=null;qrEl('qrResult').replaceChildren();
  if(!navigator.mediaDevices?.getUserMedia){qrStatus('Камера недоступна в этом браузере. Выберите фото QR-кода.');return;}
  const run=qrRun;qrEl('qrCamera').disabled=true;qrStatus('Разрешите доступ к камере.');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    if(run!==qrRun){stream.getTracks().forEach(t=>t.stop());return;}
    qrStream=stream;const video=qrEl('qrVideo');video.srcObject=stream;video.style.display='block';qrEl('qrStop').style.display='block';
    await video.play();if(run!==qrRun)return;qrStatus('Держите один QR-код в кадре, крупно и без бликов.');
    const scan=async()=>{
      if(run!==qrRun)return;
      try{if(video.readyState>=2 && video.videoWidth){
        const canvas=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(video.videoWidth,video.videoHeight));
        canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        let codes=[];try{codes=await readAllQRCodes(pixels);}catch(error){console.warn('QR decoder unavailable',error);}
        if(run!==qrRun)return;
        if(!codes.some(isPaymentQR)){const fallback=decodeQRPixels(pixels);if(fallback)codes.push(fallback);}
        if(codes.some(isPaymentQR)){stopQRCamera();showQRResults(codes);return;}
        if(codes.length)qrStatus('В кадре QR со ссылкой или другого формата. Наведите камеру на платёжный QR квитанции.');
      }}catch(error){if(run!==qrRun)return;stopQRCamera();qrStatus(error.message);return;}
      if(run===qrRun)qrTimer=setTimeout(scan,400);
    };scan();
  }catch(error){if(run!==qrRun)return;stopQRCamera();qrStatus('Не удалось открыть камеру. Разрешите доступ в настройках браузера или выберите фото.');}
}
async function readQRPhoto(file){
  if(!file)return;stopQRCamera();const run=++qrPhotoRun;qrCandidates=[];qrDraft=null;qrEl('qrResult').replaceChildren();
  if(file.size>20*1024*1024){qrStatus('Фото слишком большое. Выберите изображение до 20 МБ.');return;}
  if(file.type && !file.type.startsWith('image/')){qrStatus('Выберите изображение QR-кода (например, JPG или PNG).');return;}
  qrStatus('Ищу все QR-коды на фото…');let url=null;
  try{
    let codes=[];
    try{codes=await readAllQRCodes(file);}catch(error){console.warn('QR decoder unavailable',error);}
    if(run!==qrPhotoRun)return;
    if(!codes.some(isPaymentQR)){
      url=URL.createObjectURL(file);const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      if(run!==qrPhotoRun)return;
      const code=await decodeQRPhoto(img,img.naturalWidth,img.naturalHeight,()=>run===qrPhotoRun);
      if(run!==qrPhotoRun)return;if(code)codes.push(code);
    }
    if(!codes.length){qrStatus('Не удалось прочитать QR после нескольких попыток. Обрежьте фото вокруг одного кода, оставив белую рамку, и загрузите снова. Если не поможет — введите начисление вручную.');return;}
    showQRResults(codes);
  }catch(error){if(run===qrPhotoRun)qrStatus(error.message||'Не удалось прочитать фото. Попробуйте JPG или PNG.');}
  finally{if(url)URL.revokeObjectURL(url);}
}
// INNs below are taken from the supplied receipts; this is classification, not recipient verification.
function detectQRProvider(receipt, providers){
  const normalize=value=>String(value||'').trim().toLowerCase().replaceAll('ё','е').replace(/[«»"“”„]/g,'').replace(/^(?:ооо|муп|ао|пао|гуп)\s+/,'').replace(/\s+/g,' ').trim();
  const known=[
    {provider:'Экотехпром',inn:'0726008909',names:['экотехпром']},
    {provider:'Нальчикская теплоснабжающая компания',inn:'0700005477',names:['нтс','нальчикские тепловые сети','нальчикская теплоснабжающая компания']}
  ];
  const inn=String(receipt.fields?.payeeinn||'').trim(),name=normalize(receipt.recipient);
  const byInn=known.find(x=>x.inn===inn);
  const byName=known.find(x=>x.names.includes(name));
  if(byInn){
    if(byName&&byName!==byInn)return null;
    return providers.includes(byInn.provider)?{provider:byInn.provider,basis:'ИНН получателя'}:null;
  }
  if(byName){
    if(inn&&inn!==byName.inn)return null;
    return providers.includes(byName.provider)?{provider:byName.provider,basis:'названию получателя'}:null;
  }
  const matches=providers.filter(p=>!['Другое','Управляющая компания'].includes(p)&&normalize(p)===name);
  return matches.length===1?{provider:matches[0],basis:'названию получателя'}:null;
}
function showQRResult(code){
  try{qrDraft=parseReceiptQR(receiptQRText(code));}catch(error){qrDraft=null;qrStatus(error.message);return;}
  qrStatus('QR-код прочитан. Проверьте данные перед сохранением.');
  const x=qrDraft;
  const currentAddress=savedAddress?`${savedAddress.street}, д. ${savedAddress.house}, кв. ${savedAddress.apartment}`:'Адрес в приложении не выбран';
  const providers=[...qrEl('billProvider').options].map(o=>o.value);
  const details=[['Получатель',x.recipient],['ИНН',x.fields.payeeinn],['Расчётный счёт получателя',x.fields.personalacc],['Банк',x.fields.bankname],['БИК',x.fields.bic],['Адрес в QR',x.address],['Назначение',x.purpose]];
  qrEl('qrResult').innerHTML=`<div class="notice" style="margin-top:12px">Сохранение добавит начисление. Оплата и отправка поставщику не выполняются.</div>${details.filter(([,v])=>v).map(([k,v])=>`<div class="field"><b>${k}</b><span style="overflow-wrap:anywhere">${escapeHtml(v)}</span></div>`).join('')}<p class="muted">Ваш адрес: ${escapeHtml(currentAddress)}</p><label class="formlabel" for="qrProvider">Услуга / поставщик *</label><select id="qrProvider" class="input" aria-describedby="qrProviderHint" onchange="document.getElementById('qrProviderHint').textContent='Поставщик выбран вручную.'"><option value="">Выберите, к какой услуге относится квитанция</option>${providers.map(p=>`<option>${escapeHtml(p)}</option>`).join('')}</select><div id="qrProviderHint" class="muted" style="margin-top:6px">Не удалось однозначно определить услугу. Выберите её вручную.</div><label class="formlabel" for="qrAccount">Лицевой счёт *</label><input id="qrAccount" class="input" value="${escapeHtml(x.account)}" placeholder="Нет в QR — введите вручную"><label class="formlabel" for="qrPeriod">Период *</label><input id="qrPeriod" class="input" value="${escapeHtml(x.period)}" placeholder="Нет в QR — например, 09.2026"><label class="formlabel" for="qrTotal">К оплате, ₽ *</label><input id="qrTotal" class="input" inputmode="decimal" value="${escapeHtml(x.total.replace('.',','))}" placeholder="Нет в QR — введите вручную"><label style="display:flex;gap:8px;margin-top:14px;font-size:13px"><input type="checkbox" id="qrConfirmed">Я сверил получателя, адрес, лицевой счёт, период и сумму с квитанцией</label><div id="qrSaveError" role="alert" tabindex="-1" style="margin-top:12px"></div><button id="qrSave" class="btn block" onclick="saveQRBill()">Сохранить начисление</button>${qrCandidates.length>1?'<button class="btn secondary block" onclick="showQRChoices()">Выбрать другой QR</button>':''}`;
  const detected=detectQRProvider(x,providers);
  if(detected){qrEl('qrProvider').value=detected.provider;qrEl('qrProviderHint').textContent='Подставлено по '+detected.basis+'. Проверьте; при необходимости измените.';}
}
function qrSaveError(message,field){
  const box=qrEl('qrSaveError');
  if(box){box.className='notice';box.textContent=message;box.scrollIntoView({block:'center',behavior:'smooth'});box.focus({preventScroll:true});}
  else qrStatus(message);
  if(field)qrEl(field)?.setAttribute('aria-invalid','true');
}
function saveQRBill(){
  const errorBox=qrEl('qrSaveError');if(errorBox){errorBox.textContent='';errorBox.className='';}
  document.querySelectorAll('#qrResult [aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));

  if(!qrDraft)return;
  const provider=qrEl('qrProvider').value,account=qrEl('qrAccount').value.trim(),period=qrEl('qrPeriod').value.trim();
  const totalText=qrEl('qrTotal').value.replace(/\s/g,'').replace(',','.');
  if(!provider){qrSaveError('Выберите услугу / поставщика в форме выше.','qrProvider');return;}
  if(!account){qrSaveError('Укажите лицевой счёт жильца.','qrAccount');return;}
  if(!period){qrSaveError('Укажите расчётный период.','qrPeriod');return;}
  if(!/^\d+(\.\d{1,2})?$/.test(totalText)||!Number.isSafeInteger(Math.round(Number(totalText)*100))){qrSaveError('Введите сумму в рублях: например, 1250,50.');return;}
  if(!qrEl('qrConfirmed').checked){qrSaveError('Сверьте данные с квитанцией и отметьте подтверждение.');return;}
  const periodKey=v=>String(v).toLowerCase().replace(/\s+/g,' ').trim();
  if(manualBills.some(b=>b.qrRaw===qrDraft.raw || (b.provider===provider && b.account===account && periodKey(b.period)===periodKey(period)))){qrSaveError('Это начисление уже есть. Откройте «Начисления» и при необходимости измените существующую запись.');return;}
  const newAccounts=accounts.some(a=>a.provider===provider&&a.number===account)?accounts:[...accounts,{provider,number:account,icon:icons[provider]||'🏠'}];
  const record={id:Date.now(),provider,account,period,total:Number(totalText),accrued:0,debt:0,paid:0,paidDate:'',source:'qr',qrRaw:qrDraft.raw,qrFields:{...qrDraft.fields},address:qrDraft.address,createdAt:new Date().toISOString()};
  const newBills=[record,...manualBills];
  // Roll back both keys on storage failure, preserving the current in-memory state.
  const oldAccounts=localStorage.getItem('mydomAccounts'),oldBills=localStorage.getItem('mydomManualBills');
  try{localStorage.setItem('mydomAccounts',JSON.stringify(newAccounts));localStorage.setItem('mydomManualBills',JSON.stringify(newBills));}
  catch(error){try{for(const [k,v] of [['mydomAccounts',oldAccounts],['mydomManualBills',oldBills]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}catch(_){}qrSaveError('Не удалось сохранить данные в браузере. Освободите место и повторите.');return;}
  accounts=newAccounts;manualBills=newBills;closeQR();renderAll();go('bills');
  const confirmation=document.createElement('div');confirmation.className='success';confirmation.setAttribute('role','status');confirmation.textContent='Начисление сохранено. Лицевой счёт добавлен в ваши счета.';qrEl('billList').prepend(confirmation);
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopQRCamera();});
  window.addEventListener('pagehide',stopQRCamera);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&qrEl('qrModal').classList.contains('show'))closeQR();});
}
if(typeof module!=='undefined' && module.exports)module.exports={parseReceiptQR,receiptQRText,qrPhotoRegions,detectQRProvider};
