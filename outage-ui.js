/* Spatial results are informational, never proof of an active network outage. */
(function(){
 const match=e=>OutageMatcher.match(e,savedAddress,window.outageHouseLocations||{});
 const legacy=eventMatches;
 // Spatial matching alone must not suppress a resident report or trigger confirmed-outage notifications.
 eventMatches=function(e){return e.scope?false:legacy(e);};
 const renderLegacy=renderHouseEvents;
 renderHouseEvents=function(){
  renderLegacy();const box=document.getElementById('houseEventsBlock');if(!box||!savedAddress)return;
  const scoped=houseEvents.filter(e=>e.scope).map(e=>({event:e,match:match(e)})).filter(x=>x.match.status!=='outside');
  if(!scoped.length)return;
  // Legacy renderer may already include exact structured events; rebuild those cards once.
  const original=houseEvents;try{houseEvents=original.filter(e=>!e.scope);renderLegacy();}finally{houseEvents=original;}
  const labels={exact:'Ваш адрес указан',zone:'Дом попадает в описанную зону',possible:'Возможно, касается вашего дома'};
  for(const {event:e,match:m} of scoped){
   const card=document.createElement('div');card.className='card event-card';
   const add=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;card.append(node);};
   add('strong',labels[m.status]);add('h3',e.title||'Сообщение об отключении');add('p',m.reason,'muted');add('p',e.description||'');
   add('p','Начало: '+fmtDT(e.start)+(e.end?' · Плановое окончание: '+fmtDT(e.end):''),'event-meta');
   add('p','Источник: '+(e.source||'не указан'),'event-source');
   if(e.sourceUrl){try{const url=new URL(e.sourceUrl);if(url.protocol==='https:'){const link=document.createElement('a');link.href=url.href;link.rel='noopener noreferrer';link.target='_blank';link.textContent='Открыть объявление';card.append(link);}}catch(_){}}
   add('p','Совпадение адреса не подтверждает текущее состояние услуги. Плановое время окончания не означает, что подача восстановлена.','muted');box.append(card);
  }
 };
 renderHouseEvents();
})();
