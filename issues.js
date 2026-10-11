/* Local complaint drafts. No transmission to suppliers. Reviewed 2026-10-11. */
(function(){
 const quality=new Set(['Перебой или ненадлежащее качество услуги','Нет воды','Нет горячей воды','Нет отопления','Нет электричества','Слабое давление']);
 function requests(kind,description='',guide){
  if(kind==='Неверное начисление'&&['waste','housing'].includes(guide?.service))return 'Прошу проверить начисление за указанный период, предоставить подробный расчёт с указанием тарифа, применённой базы расчёта и исходных данных. При выявлении ошибки прошу исправить начисление и направить корректные сведения о состоянии лицевого счёта.';
  if(quality.has(kind))return 'Прошу зарегистрировать сообщение, установить причину и продолжительность перебоя или отклонения качества услуги. При необходимости прошу согласовать проверку и оформить её результаты актом, предоставить мне его экземпляр. Прошу принять меры к восстановлению надлежащего предоставления услуги и сообщить о принятых мерах. При наличии предусмотренных законом оснований прошу произвести перерасчёт платы за соответствующий период.\n\nПрошу рассмотреть заявление с учётом Правил предоставления коммунальных услуг, утверждённых постановлением Правительства РФ от 06.05.2011 № 354, в части, применимой к указанным обстоятельствам.';
  if(kind==='Неверное начисление')return 'Прошу проверить начисление за указанный период, предоставить подробный расчёт с указанием применённых тарифов, объёмов потребления, показаний приборов учёта и иных оснований расчёта. При выявлении ошибки прошу исправить начисление и направить корректные сведения о состоянии лицевого счёта.';
  if(kind==='Не учтён платёж')return 'Прошу провести сверку расчётов и проверить поступление платежа по указанному лицевому счёту по платёжным документам. Если платёж поступил, прошу отразить его на соответствующем лицевом счёте и проверить связанные начисления задолженности и пеней. Прошу сообщить результат проверки, а при отсутствии платежа — какие сведения нужны для его розыска.';
  if(kind==='Нужен перерасчёт' && /показан[а-яё]*\s+(?:прибора\s+уч[её]та|сч[её]тчика)/i.test(description))return 'Прошу проверить сведения о показаниях прибора учёта и возможность их использования при расчёте платы. Прошу сообщить, какие показания и подтверждающие документы необходимы для проверки. При наличии оснований прошу произвести перерасчёт за указанный период и предоставить расчёт. При отказе прошу указать фактические и правовые основания решения.';
  if(kind==='Нужен перерасчёт')return 'Прошу проверить наличие оснований для перерасчёта платы по указанному лицевому счёту и сообщить, какие сведения и документы необходимы для проверки. При наличии оснований прошу произвести перерасчёт за указанный период и предоставить расчёт. При отказе прошу указать фактические и правовые основания решения.';
  if(kind==='Проблема со счётчиком')return 'Прошу проверить состояние и учётные сведения прибора учёта и разъяснить порядок дальнейших действий, включая необходимость осмотра, поверки, замены или ввода прибора в эксплуатацию. При необходимости прошу согласовать осмотр. Прошу разъяснить порядок расчёта платы на соответствующий период.';
  if(['Проблема в подъезде','Содержание дома','Аварийная ситуация'].includes(kind))return 'Прошу зарегистрировать обращение, организовать обследование указанного участка общего имущества и зафиксировать результаты. Прошу принять меры в пределах вашей ответственности, сообщить сроки устранения выявленных недостатков и предоставить письменный ответ о результатах. Прошу учитывать Правила содержания общего имущества в многоквартирном доме, утверждённые постановлением Правительства РФ от 13.08.2006 № 491, в части, применимой к ситуации.';
  return 'Прошу рассмотреть вопрос по указанной услуге, уточнить необходимые сведения и принять меры в пределах вашей ответственности. Прошу предоставить мотивированный ответ с описанием результатов проверки и принятых мер.';
 }
 function compose(d){return ['Кому: '+d.recipient,'От: '+d.applicant,'Адрес помещения: '+d.address,d.account?'Лицевой счёт: '+d.account:'','Адрес для ответа (почтовый или электронный): '+d.reply,d.contact?'Телефон / контакт: '+d.contact:'','', 'ЗАЯВЛЕНИЕ','По вопросу: '+d.kind,window.IssueGuide?.context(d.guide)||'','',d.period?'Дата, время или период: '+d.period:'',d.dispatch?'Предыдущее обращение / заявка в диспетчерскую: '+d.dispatch:'','',requests(d.kind,d.guide?.reason==='readings'?'показания счётчика':d.text,d.guide),'','Прошу направить ответ по указанному выше адресу.',d.attachments?'\nПриложения (предоставляются заявителем отдельно):\n'+d.attachments:'','', 'Дата: '+new Date(d.createdAt).toLocaleDateString('ru-RU'),'Подпись: __________________ / '+d.applicant+' /'].filter(v=>v!==null).join('\n');}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function html(text){return '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Заявление</title><style>body{margin:24px;font:16px/1.5 Georgia,serif;color:#000;background:#fff}main{max-width:180mm;margin:auto;white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:20mm}@media print{body{margin:0}main{max-width:none}}</style><body><main>'+esc(text)+'</main></body></html>';}
 window.IssueDrafts={compose,requests,html};
 const el=id=>document.getElementById(id);
 function add(p,tag,text,cls){const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;p.append(x);return x;}
 function button(p,text,fn,secondary=false){const b=add(p,'button',text,'btn '+(secondary?'secondary ':'')+'block');b.type='button';b.onclick=fn;return b;}
 function field(p,id,label,value='',multi=false,required=false){const l=add(p,'label',label+(required?' *':''),'formlabel');l.htmlFor=id;const x=add(p,multi?'textarea':'input','','input');x.id=id;x.value=value;x.required=required;x.maxLength=multi?8000:500;if(multi){x.rows=4;x.style.fontFamily='inherit';}return x;}
 function address(){return savedAddress?'г. Нальчик, '+savedAddress.street+', '+savedAddress.house+(savedAddress.isPrivate?'':', кв. '+savedAddress.apartment):'';}
 function recipient(provider,account){
  if(provider==='Управляющая компания')return window.Management?.resolve(savedAddress)?.org?.name||'';
  const names=[...new Set(manualBills.filter(b=>b.provider===provider&&(!account||b.account===account)).map(b=>b.qrFields?.name).filter(Boolean))];
  return names.length===1?names[0]:provider;
 }
 let draft=null,printFrame=null;
 renderIssueProviderStep=function(){const p=el('issueStep');p.replaceChildren();add(p,'p','Выберите услугу или организацию.','muted');for(const name of new Set([...Object.keys(issueKinds),...accounts.map(a=>a.provider)]))button(p,name,()=>renderIssueKindStep(name),true);};
 renderIssueKindStep=function(provider){const p=el('issueStep');p.replaceChildren();button(p,'← Другая организация',renderIssueProviderStep,true);add(p,'h3',provider);for(const k of issueKinds[provider]||['Неверное начисление','Не учтён платёж','Другое'])button(p,k,()=>renderIssueForm(provider,k),true);};
 // An outage notice must never prevent a resident from preparing a complaint.
 handleIssueKind=function(provider,kind){renderIssueForm(provider,kind);};
 renderIssueForm=function(provider,kind,existing){
  const p=el('issueStep');p.replaceChildren();const acc=accounts.filter(a=>a.provider===provider);
  const number=existing?.account??(acc.length===1?acc[0].number:'');
  let collect;button(p,'← Назад',()=>existing?.guide?window.IssueGuide.resume(collect()):renderIssueKindStep(provider),true);add(p,'h3',kind);
  if(existing?.guide?.explanation)add(p,'p',existing.guide.explanation,'notice');
  if(kind==='Аварийная ситуация')add(p,'p','При угрозе жизни или безопасности звоните 112. Подготовка документа не вызывает аварийную службу.','redbox');
  if(quality.has(kind))add(p,'p','Сообщите о перебое в аварийно-диспетчерскую службу. Запишите номер заявки и время регистрации.','notice');
  if(provider==='Водоканал'&&kind==='Нет воды'&&waterIncidentForAddress())add(p,'p','В приложении есть сообщение об отключении по адресу. Вы можете подготовить обращение независимо от него.','notice');
  add(p,'p','Сверьте адресата с квитанцией или договором: получатель платежа может отличаться от исполнителя услуги. Название можно исправить.','muted');
  const f=add(p,'form','');
  field(f,'issueRecipient','Кому: полное название организации',existing?.recipient??recipient(provider,number),false,true);
  field(f,'issueApplicant','Ваши фамилия, имя, отчество (при наличии)',existing?.applicant||'',false,true);
  field(f,'issueAddress','Адрес помещения',existing?.address||address(),false,true);
  field(f,'issueAccount','Лицевой счёт',number);
  if(acc.length>1)add(f,'p','У этой организации несколько счетов. Укажите нужный.','muted');
  field(f,'issueReply','Почтовый или электронный адрес для ответа',existing?.reply||'',false,true);
  field(f,'issueContact','Телефон (необязательно)',existing?.contact||'');
  field(f,'issuePeriod','Дата, время или период проблемы',existing?.period||'');
  const facts=field(f,'issueText','Что произошло: опишите своими словами',existing?.text||'',true,true);
  add(f,'p','Это описание останется в карточке обращения и не будет дословно вставлено в документ. Приложение подготовит типовую формулировку; конкретные суммы, показания и другие важные детали проверьте и дополните в редакторе.','muted');
  facts.placeholder=kind==='Не учтён платёж'?'Дата, сумма, способ оплаты, номер операции и период.':kind==='Неверное начисление'?'Период, услуга, начисленная сумма и в чём вы видите ошибку.':'Когда и где обнаружили проблему, что наблюдаете, предпринимали ли какие-либо действия.';
  field(f,'issueDispatch','Ранее поданная заявка: номер, дата, ответ',existing?.dispatch||'');
  const attachmentList=field(f,'issueAttachments','Перечень приложений: квитанции, чеки, фото, акты',existing?.attachments||'',true);
  window.IssueGuide?.renderDocuments(f,existing?.guide,kind,attachmentList);
  add(f,'p','Файлы к заявлению нужно приложить самостоятельно. Документ не отправляется поставщику автоматически.','notice');
  const submit=add(f,'button','Подготовить текст','btn block');submit.type='submit';
  collect=()=>{const value=id=>el(id).value.trim();return {...existing,documentBasis:existing?.documentBasis||(existing?.documentText?compose(existing):undefined),id:existing?.id||crypto.randomUUID(),provider,kind,guide:existing?.guide,recipient:value('issueRecipient'),applicant:value('issueApplicant'),address:value('issueAddress'),account:value('issueAccount'),reply:value('issueReply'),contact:value('issueContact'),period:value('issuePeriod'),text:value('issueText'),dispatch:value('issueDispatch'),attachments:value('issueAttachments'),createdAt:existing?.createdAt||new Date().toISOString(),status:'Подготовлено · не отправлено поставщику'};};
  f.onsubmit=e=>{e.preventDefault();if(!f.reportValidity())return;const data=collect();
   if(!data.recipient||!data.applicant||!data.address||!data.reply||!data.text){alert('Заполните обязательные поля.');return;}const generated=compose(data),basis=existing?.documentBasis|| (existing?compose(existing):'');if(existing?.documentText&&existing.documentText!==basis&&generated!==basis&&!confirm('Данные обращения изменились. Сформировать текст заново? Ручные правки в тексте будут заменены.'))return;data.documentText=existing?.documentText&&generated===basis?existing.documentText:generated;data.documentBasis=generated;preview(data);};
  el('issueModal').querySelector('.sheet').scrollTop=0;
 };
 async function persist(d){const next=[d,...residentIssues.filter(x=>x.id!==d.id)];try{await SafeStore.commit({mydomResidentIssues:JSON.stringify(next)});}catch(_){alert('Не удалось сохранить обращение. Текст остаётся на экране. Освободите место и повторите.');return false;}residentIssues=next;renderIssueList();return true;}
 function preview(d){draft={...d};const p=el('issueStep');p.replaceChildren();button(p,'← Назад',()=>renderIssueForm(draft.provider,draft.kind,{...draft,documentText:el('issueDocument').value}),true);add(p,'h3','Проверьте обращение');add(p,'p','Исходное описание не включено в документ. Проверьте и дополните фактические обстоятельства, суммы и показания. Перерасчёт зависит от установленных оснований.','muted');const area=field(p,'issueDocument','Текст документа',draft.documentText||compose(draft),true,true);area.rows=18;area.maxLength=30000;
  const status=add(p,'p','Не отправлено поставщику','notice');status.setAttribute('role','status');
  const save=async()=>{if(!area.value.trim()){alert('Текст обращения пуст.');return false;}draft.documentText=area.value;draft.updatedAt=new Date().toISOString();if(!await persist({...draft}))return false;status.textContent='Сохранено на этом устройстве. Не отправлено поставщику.';return true;};
  button(p,'Сохранить обращение',save);
  button(p,'Сформировать заново',()=>{if(confirm('Заменить текст типовой формулировкой без исходного описания? Ваши правки в документе будут заменены.')){area.value=compose(draft);status.textContent='Новый текст ещё не сохранён.';}},true);
  button(p,'Печать / PDF',async()=>{if(!await save())return;printFrame?.remove();printFrame=document.createElement('iframe');printFrame.title='Печать обращения';printFrame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';printFrame.onload=()=>{printFrame.contentWindow.focus();printFrame.contentWindow.print();};printFrame.srcdoc=html(draft.documentText);document.body.append(printFrame);},true);
  const download=async(type)=>{if(!await save())return;const blob=new Blob([type==='html'?html(draft.documentText):'\uFEFF'+draft.documentText],{type:type==='html'?'text/html;charset=utf-8':'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='obrashchenie-'+String(draft.createdAt).slice(0,10)+'.'+type;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  button(p,'Скачать документ (HTML)',()=>download('html'),true);button(p,'Скачать текст (TXT)',()=>download('txt'),true);
  el('issueModal').querySelector('.sheet').scrollTop=0;
  add(p,'p','HTML можно открыть в браузере и распечатать. Для PDF выберите сохранение в системном меню печати, если оно доступно на устройстве. Передайте обращение адресату и сохраните подтверждение подачи.','muted');
 }
 renderIssueList=function(){const p=el('issueList');if(!p)return;p.replaceChildren();if(!residentIssues.length){add(p,'div','Подготовленных обращений пока нет.','card empty');return;}for(const d of residentIssues){const c=add(p,'div','','card');add(c,'h3',d.kind);add(c,'p',(d.recipient||d.provider)+' · '+fmtDT(d.createdAt),'muted');add(c,'p',d.text);add(c,'p','Подготовлено · не отправлено поставщику','notice');button(c,'Открыть / выгрузить',()=>{el('issueModal').classList.add('show');if(d.documentText)preview(d);else renderIssueForm(d.provider,d.kind,d);},true);button(c,'Удалить',async()=>{if(!confirm('Удалить подготовленное обращение?'))return;const next=residentIssues.filter(x=>x.id!==d.id);try{await SafeStore.commit({mydomResidentIssues:JSON.stringify(next)});}catch(_){alert('Не удалось удалить обращение.');return;}residentIssues=next;renderIssueList();},true);}};
 renderIssueList();
})();
