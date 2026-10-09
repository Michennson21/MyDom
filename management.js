/* Address-based suggestions, with explicit provenance and manual choices. */
(function(){
 const data=window.managementData;
 const norm=s=>String(s||'').toLowerCase().replaceAll('ё','е').replace(/\s+/g,' ').trim();
 const street=s=>norm(s).replace(/^(?:улица|ул\.?|переулок|пер\.?|проспект|пр-кт\.?)\s+/,'');
 const house=s=>norm(s).replace(/^(?:двлд|дмвлд|зд|дом|д)\.?\s*(?=\d)/,'').replace(/(?:корпус|корп\.?|кор\.?)/g,'к').replace(/[,\s]/g,'').replace(/(\d)-(?=[а-я]$)/g,'$1');
 const key=a=>street(a.street)+'|'+house(a.house);
 const orgName=s=>norm(s).replace(/[«»"“”]/g,'').replace(/^(?:ооо|муп|ук|жэук)\s+/g,'').replace(/^ук\s+/,'').trim();
 const organizations=[...data.organizations];
 const byName=name=>organizations.find(x=>orgName(x.name)===orgName(name));
 const legacy=Object.entries({...orgMap,...currentOrgMap}).map(([address,v])=>{
  let org=byName(v.org);if(!org){org={id:'legacy:'+orgName(v.org),name:v.org,sourceKind:'legacy'};organizations.push(org);}
  const [street,house]=address.split('|');return {street,house,orgId:org.id,sourceKind:'legacy',note:v.source};
 });
 const assignments=[...legacy,...data.assignments];
 function resolve(address){
  if(!address)return {status:'missing',entries:[]};
  if(address.managementOverride){const o=address.managementOverride;return {status:'manual',org:organizations.find(x=>x.id===o.orgId)||{name:o.name},entries:[]};}
  if(address.isPrivate||/\b(?:снт|сдт)\b/i.test(address.street)||/(?:снт|сдт|с\/т)\s/i.test(address.street))return {status:'private',entries:[]};
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
  const all=assignments.filter(x=>key(x)===key(address));
  const entries=all.filter(x=>(!x.validFrom||x.validFrom<=today)&&(!x.validTo||x.validTo>=today));
  if(all.length&&!entries.length)return {status:'expired',entries:all};
  const ids=[...new Set(entries.map(x=>x.orgId))];
  if(!ids.length)return {status:'missing',entries};
  if(ids.length>1)return {status:'conflict',entries};
  return {status:entries.some(x=>x.sourceKind==='secondary')?'catalog':'legacy',org:organizations.find(x=>x.id===ids[0]),entries};
 }
 const labels={expired:'Период управления из источника не действует на текущую дату',manual:'Указано вами',catalog:'По открытому каталогу · требует проверки',legacy:'Прежняя запись · актуальность не подтверждена',conflict:'Источники расходятся · требуется уточнение',private:'Автоматически не назначается для частного дома или СНТ',missing:'Сведения по дому не найдены'};
 window.Management={resolve,key,organizations,labels,data};
 findOrg=function(street,house){const r=resolve({street,house});return r.org?{org:r.org.name,source:labels[r.status]}:null;};
})();
