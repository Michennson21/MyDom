/* Spatial results are informational, never proof of an active network outage. */
(function(){
 let feed=null,feedError='';
 const match=e=>OutageMatcher.match(e,savedAddress,window.outageHouseLocations||{});
 const legacy=eventMatches;
 // Spatial matching alone must not suppress a resident report or trigger confirmed-outage notifications.
 eventMatches=function(e){return e.scope?false:legacy(e);};
 const renderLegacy=renderHouseEvents;
 renderHouseEvents=function(){
  renderLegacy();const box=document.getElementById('houseEventsBlock');if(!box||!savedAddress)return;
  if(feed)box.querySelector('.greenbox')?.closest('.card')?.remove();
  if(feed||feedError){const status=document.createElement('div');status.className='card';status.textContent=feedError||Object.entries(feed.sources).map(([id,x])=>(id==='water'?'Водоканал':'Россети')+': '+(x.state==='ok'?'источник проверен':'ошибка загрузки')+'; последняя успешная проверка: '+fmtDT(x.lastSuccessAt)).join(' · ');if(feed&&Date.now()-Date.parse(feed.checkedAt)>3600000)status.append(' · Данные устарели: проверка более часа назад.');box.prepend(status);}
  const current=(feed?.events||[]).filter(e=>{const date=e.start||e.publishedAt;if(!date)return true;return Date.parse(date)>=Date.now()-(e.start?86400000:7*86400000);});
  const scoped=[...houseEvents,...current].filter(e=>e.scope).map(e=>({event:e,match:match(e)})).filter(x=>x.match.status!=='outside');
  if(!scoped.length){if(feed){const empty=document.createElement('p');empty.className='muted';empty.textContent='В загруженной подборке нет подходящих объявлений. Это не подтверждает отсутствие отключений.';box.append(empty);}return;}
  const labels={exact:'Ваш адрес указан',zone:'Дом попадает в описанную зону',possible:'Возможно, касается вашего дома'};
  for(const {event:e,match:m} of scoped){
   const card=document.createElement('div');card.className='card event-card';
   const add=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;card.append(node);};
   add('strong',labels[m.status]);add('h3',e.title||'Сообщение об отключении');add('p',m.reason,'muted');add('p',e.description||'');
   if(e.start&&Date.parse(e.end||e.start)<Date.now())add('p','Плановое время прошло; восстановление не подтверждено.','muted');
   if(e.reviewRequired)add('p','Адреса или сроки требуют уточнения — проверьте оригинал объявления.','muted');
   add('p','Начало: '+fmtDT(e.start)+(e.end?' · Плановое окончание: '+fmtDT(e.end):''),'event-meta');
   add('p','Источник: '+(e.source||'не указан'),'event-source');
   if(e.sourceUrl){try{const url=new URL(e.sourceUrl);if(url.protocol==='https:'){const link=document.createElement('a');link.href=url.href;link.rel='noopener noreferrer';link.target='_blank';link.textContent='Открыть объявление';card.append(link);}}catch(_){}}
   add('p','Совпадение адреса не подтверждает текущее состояние услуги. Плановое время окончания не означает, что подача восстановлена.','muted');box.append(card);
  }
 };
 renderHouseEvents();
 async function refresh(){try{const response=await fetch('./api/outages',{cache:'no-store'});if(!response.ok){if(feed){feedError='Не удалось обновить объявления. Показана предыдущая копия.';renderHouseEvents();}return;}const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.events)||!data.sources||!Number.isFinite(Date.parse(data.checkedAt)))throw Error('Invalid feed');feed=data;feedError='';renderHouseEvents();}catch(_){if(feed){feedError='Не удалось обновить объявления. Показана предыдущая копия.';renderHouseEvents();}}}
 refresh();setInterval(refresh,300000);
})();
