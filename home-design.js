/* Green Nalchik home. Uses only the current apartment's actual local records. */
(function(){
 const el=id=>document.getElementById(id),home=el('home');
 const paths={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',bill:'M6 3h9l4 4v14H6ZM14 3v5h5M9 12h7M9 16h7',meter:'M5 20V10h3v10M11 20V4h3v16M17 20v-7h3v7',issues:'m5 12 4 4L19 6',more:'M5 12h.01M12 12h.01M19 12h.01',water:'M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z',power:'m13 2-8 12h6l-1 8 9-13h-7Z',gas:'M13 3c2 6-4 7-2 10 2-1 4-3 4-5 6 6 5 13-3 13-8 0-10-9-5-13-1 5 2 5 2 5-2-5 4-6 4-10Z',waste:'M4 6h16M9 3h6M7 6l1 15h8l1-15M10 10v7M14 10v7',alert:'M12 8v5M12 17h.01M10 3 2 19h20L14 3Z',chevron:'m9 5 7 7-7 7',heat:'M8 3c-5 5 5 6 0 11M15 3c-5 5 5 6 0 11M4 20h16'};
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.home);svg.append(p);return svg;}
 function add(p,tag,text='',cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;p.append(n);return n;}
 function button(p,text,fn,cls='btn secondary'){const b=add(p,'button',text,cls);b.type='button';b.onclick=fn;return b;}
 const currency=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:2});
 const money=n=>currency.format(n/100);
 const cents=n=>Number.isFinite(Number(n))?Math.round(Number(n)*100):0;
 const remaining=b=>Math.max(0,cents(b.total)-cents(b.paid));
 function latest(){return Billing.summary(manualBills).latest;}
 function service(provider){if(/водоканал|холодн.*вод/i.test(provider))return['Холодная вода','water'];if(/тепло|нтс|горяч.*вод/i.test(provider))return['Тепло и горячая вода','heat'];if(/газ/i.test(provider))return['Газ','gas'];if(/электро|энергосбыт|россети|егп/i.test(provider))return['Электроэнергия','power'];if(/экотехпром|отход|мусор/i.test(provider))return['Вывоз мусора','waste'];return[provider||'Услуга','home'];}
 const brand=document.querySelector('.brand');brand.replaceChildren(icon('home'));add(brand,'span','Мой дом');document.querySelector('.top .sub').textContent='Нальчик';
 document.querySelector('meta[name="theme-color"]').content='#174e45';
 const navIcons={home:'home',bills:'bill',meters:'meter',issues:'issues',homeinfo:'more'};
 for(const b of document.querySelectorAll('.nav [data-go]'))b.querySelector('.ni').replaceChildren(icon(navIcons[b.dataset.go]));
 const services=add(home,'section','','home-services');services.id='homeServices';
 const attention=add(home,'section','','home-attention');attention.id='homeAttention';
 const outages=add(home,'details','','home-outages');outages.id='homeOutages';add(outages,'summary','Сведения об отключениях');
 if(el('houseEventsBlock'))outages.append(el('houseEventsBlock'));
 // Existing address selector keeps its native accessibility and apartment switch behavior.
 home.querySelector('.address').after(el('homeStatus'));el('homeStatus').after(attention);attention.after(services);services.after(outages);
 const info=add(el('homeinfo'),'div','','card');info.id='appInformation';add(info,'div','О приложении','title');const version=home.querySelector('.version-label');if(version){version.textContent='Тестовая версия · 0.36';info.append(version);}document.title='Мой дом — Нальчик v0.36';add(info,'p','Данные сохраняются в этом браузере. Серверная копия доступна только после подключения сервера. Сохранённые показания и обращения не отправляются поставщикам автоматически.','muted');
 function moveNotifications(){if(el('notificationPanel'))el('homeinfo').append(el('notificationPanel'));}
 const originalEnsure=ensureNotificationPanel;ensureNotificationPanel=function(){originalEnsure();moveNotifications();};moveNotifications();
 function renderSummary(){
  const box=el('homeStatus');box.replaceChildren();const result=Billing.summary(savedAddress?manualBills:[]),bills=result.latest;
  add(box,'div',bills.length?'Остаток по квитанциям':'Ваши начисления','home-summary-label');
  add(box,'div',bills.length&&!result.issues.length?money(result.total):'—','home-total');
  add(box,'p',result.issues.length?'Есть записи, требующие проверки':bills.length?'По вашим записям · с учётом отмеченной оплаты':'Добавьте квитанцию, чтобы увидеть сумму.','muted');
  if(result.issues.length){add(box,'p','Не удалось определить итог по всем счетам: уточните периоды, суммы или повторные квитанции.','notice');button(box,'Проверить начисления',()=>go('bills'),'btn secondary block');}
  if(!savedAddress)add(box,'p','Сначала добавьте адрес в разделе «Ещё».','muted');
  const actions=add(box,'div','','home-primary-actions');
  const receipt=button(actions,'',savedAddress?openReceiptEntry:()=>go('homeinfo'),'btn');receipt.id='homeAddReceipt';receipt.append(icon('bill'));add(receipt,'span','Добавить квитанцию');
  const reading=button(actions,'',()=>go('meters'),'btn secondary');reading.id='homeAddReading';reading.append(icon('meter'));add(reading,'span','Внести показания');
  if(bills.length){const details=add(box,'details','','home-calculation');add(details,'summary','Как рассчитана сумма');add(details,'p','Квитанция за самый поздний расчётный месяц каждого лицевого счёта за вычетом отмеченной вами оплаты. Периоды могут отличаться. Это не подтверждённая поставщиками задолженность.','muted');}
  if(savedAddress){el('addressTitle').textContent=savedAddress.street+', '+window.cleanHouseNumber(savedAddress.house);el('apartmentTitle').textContent=savedAddress.isPrivate?'Частный дом':'Квартира '+savedAddress.apartment;}
  else {el('addressTitle').textContent='Выберите ваш дом';el('apartmentTitle').textContent='Добавление адреса — в «Ещё»';}
  renderServices(bills,result.issues);
 }
 function renderServices(bills,issues=[]){services.replaceChildren();const head=add(services,'div','','home-section-head');add(head,'h2','Услуги');button(head,'Все начисления',()=>go('bills'),'home-text-button');const card=add(services,'div','','card');
  const rows=new Map();for(const a of (savedAddress?accounts:[]))rows.set(JSON.stringify([a.provider,a.number]),{provider:a.provider,account:a.number});for(const b of bills)rows.set(JSON.stringify([b.provider,b.account]),b);
  for(const x of issues)rows.set(JSON.stringify([x.provider,x.account]),x);
  if(!rows.size){add(card,'p','Здесь появятся услуги по вашим лицевым счетам.','muted');button(card,'Добавить лицевой счёт',savedAddress?()=>openAccount():()=>go('homeinfo'),'btn secondary block');return;}
  for(const b of rows.values()){const [name,type]=service(b.provider),row=add(card,'div','','home-service-row');const symbol=add(row,'span','','home-service-icon');symbol.append(icon(type));const text=add(row,'div','','home-service-copy');add(text,'strong',name);add(text,'small','Л/с '+b.account+(b.period?' · '+Billing.label(b.period):''));if(name!==b.provider)add(text,'small',b.provider);add(row,'span',b.reason?'Проверьте квитанции':Object.hasOwn(b,'total')?money(remaining(b)):'Нет квитанции','home-service-amount');}
 }
 function attentionRow(title,detail,fn,type='bill',warning=false){const b=button(attention,'',fn,'home-attention-row'+(warning?' is-warning':''));const symbol=add(b,'span','','home-attention-icon');symbol.append(icon(type));const copy=add(b,'span','','home-attention-copy');add(copy,'strong',title);add(copy,'small',detail);b.append(icon('chevron'));}
 function renderAttention(){attention.replaceChildren();add(attention,'h2','Требует внимания');let count=0;
  if(savedAddress)for(const a of window.MeterRegistry?.alerts?.()||[]){attentionRow(a.title,a.detail,()=>go('meters'),'alert',true);count++;}
  if(savedAddress&&residentIssues.length){attentionRow(residentIssues.length===1?'Обращение подготовлено':'Подготовленные обращения: '+residentIssues.length,'Не отправлено поставщику',()=>go('issues'));count++;}
  const eventCount=savedAddress?el('houseEventsBlock')?.querySelectorAll('.event-card').length||0:0;
  if(eventCount){attentionRow('Сообщения по вашему адресу: '+eventCount,'Проверьте источник и сроки объявления',()=>{outages.open=true;outages.scrollIntoView({block:'start',behavior:'smooth'});},'alert',true);count++;}
  if(!count)add(attention,'p','По сохранённым данным напоминаний пока нет.','home-calm-note');
 }
 function polishIcons(){for(const n of document.querySelectorAll('#billList .icon,#accountsList .icon')){const provider=n.parentElement?.textContent||'';n.replaceChildren(icon(service(provider)[1]));}for(const n of document.querySelectorAll('#houseEventsBlock .event-icon'))n.replaceChildren(icon('alert'));}
 window.HomeDesign={renderSummary,renderAttention,latest};
 renderDashboard=renderSummary;
 const oldAll=renderAll;renderAll=function(){oldAll();renderSummary();renderAttention();moveNotifications();polishIcons();};
 const oldGo=go;go=function(id){oldGo(id);if(id==='home'){renderSummary();renderAttention();}polishIcons();};
 const oldIssues=renderIssueList;renderIssueList=function(){oldIssues();renderAttention();};
 const oldEvents=renderHouseEvents;renderHouseEvents=function(){oldEvents();if(el('houseEventsBlock')?.parentElement!==outages)outages.append(el('houseEventsBlock'));renderAttention();polishIcons();};
 const oldBills=renderBills;renderBills=function(){oldBills();polishIcons();};
 renderSummary();renderAttention();polishIcons();
})();
