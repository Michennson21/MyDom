/* Pure address/geometry matching. No network calls or inferred network topology. */
(function(root){
 'use strict';
 const norm=s=>String(s||'').toLowerCase().replaceAll('ё','е').replace(/\s+/g,' ').trim();
 const street=s=>norm(s).replace(/^(?:улица|ул\.?|проспект|пр-кт)\s+/,'').replace(/^(?:сдт|снт|с\/т)\s+/,'снт ');
 const house=s=>norm(s).replace(/^(?:домовладение|дмвлд|двлд|здание|зд|дом|д)\.?\s*(?=\d)/,'').replace(/\s+/g,'');
 const key=a=>[norm(a.city||'Нальчик'),street(a.street),house(a.house)].join('|');
 const result=(status,reason)=>({status,reason});
 const unknown=reason=>result('possible',reason);
 function validPoint(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;}
 function ringValid(r){return Array.isArray(r)&&r.length>=4&&r.every(validPoint)&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1];}
 function inside(p,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
 }return hit;}
 function distance(p,a,b){const x=111320*Math.cos(p[1]*Math.PI/180),y=111320;const ax=(a[0]-p[0])*x,ay=(a[1]-p[1])*y,bx=(b[0]-p[0])*x,by=(b[1]-p[1])*y,dx=bx-ax,dy=by-ay;const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));return Math.hypot(ax+t*dx,ay+t*dy);}
 function match(event,address,locations={}){
  if(!address?.street||!address?.house)return unknown('Сначала выберите дом.');
  const s=event.scope;if(!s)return unknown('Зона объявления ещё не разобрана.');
  if(norm(s.city)!==norm(address.city||'Нальчик'))return unknown('Город не подтверждён или не совпадает.');
  if(s.ambiguous)return unknown('Описание зоны неоднозначно.');
  if(s.type==='addresses'){
   if(!Array.isArray(s.addresses)||!s.addresses.length||s.addresses.some(a=>!a.street||!a.house))return unknown('Перечень домов неполный.');
   const yes=s.addresses.some(a=>key({...a,city:s.city})===key(address));
   return yes?result('exact','Ваш адрес указан в объявлении.'):s.complete===true?result('outside','Адрес отсутствует в полном перечне этого объявления.'):unknown('Полнота перечня домов не подтверждена.');
  }
  if(s.type==='streets'){
   if(!Array.isArray(s.streets)||!s.streets.length||s.streets.some(x=>typeof x!=='string'||!x.trim()))return unknown('Перечень улиц не распознан.');
   return s.streets.some(x=>street(x)===street(address.street))?result('zone','В объявлении указана ваша улица; отдельные дома не уточнены.'):s.complete===true?result('outside','В этом объявлении перечислены другие улицы.'):unknown('Полнота перечня улиц не подтверждена.');
  }
  if(s.type==='range'){
   if(!s.street||!Number.isInteger(s.from)||!Number.isInteger(s.to)||s.from<0||s.to<s.from||!['all','odd','even'].includes(s.parity))return unknown('Диапазон домов требует уточнения.');
   if(street(s.street)!==street(address.street))return s.complete===true?result('outside','Указана другая улица.'):unknown('Полнота зоны не подтверждена.');
   const h=house(address.house),m=h.match(/^(\d+)(.*)$/);if(!m)return unknown('Номер дома не удалось сопоставить.');
   if(m[2]&&s.includeSuffixes!==true)return unknown('Не уточнено, входят ли корпуса и дома с буквами или дробями.');
   const n=Number(m[1]),yes=n>=s.from&&n<=s.to&&(s.parity==='all'||n%2===(s.parity==='odd'?1:0));
   return yes?result('exact','Дом входит в указанный диапазон номеров.'):s.complete===true?result('outside','Дом вне указанного диапазона.'):unknown('Полнота зоны не подтверждена.');
  }
  if(s.type==='polygon'){
   if(s.verified!==true||!s.source||!Number.isFinite(s.accuracyM)||s.accuracyM<0)return unknown('Границы района или участка ещё не подтверждены.');
   const rings=s.geometry?.type==='Polygon'?s.geometry.coordinates:null;
   if(!Array.isArray(rings)||!rings.length||!rings.every(ringValid))return unknown('Геометрия зоны отсутствует или некорректна.');
   const loc=locations[key(address)];
   if(!loc||loc.verified!==true||!loc.source||!validPoint(loc.point)||!Number.isFinite(loc.accuracyM)||loc.accuracyM<0)return unknown('Для этого дома нет проверенных координат.');
   const tolerance=Math.max(5,loc.accuracyM+s.accuracyM);
   if(rings.some(r=>r.slice(1).some((b,i)=>distance(loc.point,r[i],b)<=tolerance)))return unknown('Дом близко к границе зоны; точности карты недостаточно.');
   const yes=inside(loc.point,rings[0])&&!rings.slice(1).some(r=>inside(loc.point,r));
   return yes?result('zone','Дом попадает в описанную зону. Подключение к отключаемой сети не подтверждено.'):s.complete===true?result('outside','Дом находится вне подтверждённой зоны этого объявления.'):unknown('Описана только часть зоны отключения.');
  }
  return unknown('Для такого описания зоны требуется уточнение.');
 }
 const api={match,key};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OutageMatcher=api;
})(typeof globalThis==='undefined'?this:globalThis);
