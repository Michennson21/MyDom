(function(root){
 'use strict';
 const workspace=['mydomAddress','mydomAccounts','mydomManualBills','mydomResidentIssues','mydomWater','mydomMeterHistory','mydomMetersV1'];
 const keys=[...workspace,'mydomApartmentsV1','mydomWelcomeDone','mydomHouseEvents'];
 const bad=()=>{throw Error('Некорректная структура данных. Исходные записи не изменены.');};
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function text(v,required=false){if(typeof v!=='string'||v.length>50000||(required&&!v.trim()))bad();}
 function id(v){if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)bad();}else if(typeof v!=='string'||! /^[a-zA-Z0-9:_-]{1,200}$/.test(v))bad();}
 function walk(v,depth=0){if(depth>15)bad();if(typeof v==='string'&&v.length>2000000)bad();if(v&&typeof v==='object'){for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))bad();walk(v[k],depth+1);}}}
 function address(v){if(!obj(v))bad();for(const k of ['street','house'])text(v[k],true);if(v.apartment!==undefined)text(v.apartment);if(v.isPrivate!==undefined&&typeof v.isPrivate!=='boolean')bad();fields(v,['org','orgSource','gar','catalogCode','innerStreet','addressSource']);if(v.managementOverride!==undefined){if(!obj(v.managementOverride))bad();fields(v.managementOverride,['orgId','name','chosenAt']);}}
 function rows(v,check){if(!Array.isArray(v)||v.length>10000)bad();v.forEach(x=>{if(!obj(x))bad();check(x);});}
 function fields(v,names){for(const k of names)if(v[k]!==undefined)text(v[k]);}
 function meterFormat(x){if(x.tariffCount>1&&x.kind!=='Электроэнергия')bad();if(x.unit!==undefined){if(x.kind==='Электроэнергия'&&x.unit!=='кВт·ч')bad();if(['Холодная вода','Горячая вода','Газ'].includes(x.kind)&&x.unit!=='м³')bad();if(x.kind==='Тепло'&&!['Гкал','кВт·ч','МВт·ч'].includes(x.unit))bad();}if(x.unit!==undefined&&!['м³','кВт·ч','МВт·ч','Гкал'].includes(x.unit))bad();if(x.tariffCount!==undefined&&![1,2,3].includes(x.tariffCount))bad();if(x.individual!==undefined&&typeof x.individual!=='boolean')bad();for(const k of ['replacesId','replacedBy'])if(x[k]!==undefined)id(x[k]);if(x.tariffs!==undefined){if(!obj(x.tariffs)||!['2','3'].includes(String(x.tariffCount))||x.kind!=='Электроэнергия')bad();const keys=Object.keys(x.tariffs);if(keys.length!==x.tariffCount||keys.some(k=>!['T1','T2','T3'].slice(0,x.tariffCount).includes(k)))bad();for(const v of Object.values(x.tariffs))if(typeof v!=='number'||!Number.isFinite(v)||v<0)bad();if(Math.abs(Object.values(x.tariffs).reduce((a,b)=>a+b,0)-x.value)>0.001)bad();}}
 function validate(data,nested=false){
  if(!obj(data))bad();walk(data);
  for(const [k,raw] of Object.entries(data)){
   if(!(nested?workspace:keys).includes(k)||(raw!==null&&typeof raw!=='string'))bad();if(raw===null)continue;
   if(k==='mydomWelcomeDone'){if(!['0','1'].includes(raw))bad();continue;}
   if(k==='mydomWater'){if(!/^\d+(?:[.,]\d+)?$/.test(raw))bad();continue;}
   let v;try{v=JSON.parse(raw);}catch(_){bad();}walk(v);
   if(k==='mydomAddress'){if(v!==null)address(v);}
   if(k==='mydomAccounts')rows(v,x=>{text(x.provider,true);text(x.number,true);if(x.icon!==undefined){text(x.icon);if(/[<>&"']/.test(x.icon))bad();}});
   if(k==='mydomManualBills')rows(v,x=>{if(typeof x.id!=='number')bad();id(x.id);for(const f of ['provider','account','period'])text(x[f],true);for(const f of ['total','accrued','debt','paid'])if((f==='total'||x[f]!==undefined)&&(typeof x[f]!=='number'||!Number.isFinite(x[f])))bad();fields(x,['paidDate','source','createdAt','updatedAt','qrRaw','address']);if(x.qrFields!==undefined){if(!obj(x.qrFields))bad();Object.values(x.qrFields).forEach(y=>text(y));}});
   if(k==='mydomResidentIssues')rows(v,x=>{id(x.id);text(x.kind,true);fields(x,['provider','recipient','applicant','address','account','reply','contact','period','text','dispatch','attachments','createdAt','updatedAt','status','documentText','documentBasis']);if(x.guide!==undefined&&!obj(x.guide))bad();if(x.questionStep!==undefined)text(x.questionStep);if(x.questionTrail!==undefined){if(!Array.isArray(x.questionTrail)||x.questionTrail.length>20)bad();for(const h of x.questionTrail){if(!obj(h)||!obj(h.state))bad();text(h.step);}}if(x.lifecycle!==undefined&&!['draft','sent','registered','answered','resolved'].includes(x.lifecycle))bad();for(const k of ['facts','tracking','trackingDraft'])if(x[k]!==undefined){if(!obj(x[k]))bad();Object.values(x[k]).forEach(v=>text(v));}});
   if(k==='mydomMetersV1')rows(v,x=>{meterFormat(x);if(x.tariffs!==undefined)bad();id(x.id);text(x.serial,true);fields(x,['kind','model','location','provider','account','installed','commissioned','verification','nextVerification','seal','status','actionTitle','actionDate','notes','updatedAt','createdAt']);if(x.readingIdentity!==undefined){if(!obj(x.readingIdentity))bad();fields(x.readingIdentity,['kind','provider','account','serial']);}});
   if(k==='mydomMeterHistory')rows(v,x=>{meterFormat(x);if(x.tariffCount>1&&!x.tariffs)bad();id(x.id);for(const f of ['addressKey','provider','account','meter','kind','createdAt'])text(x[f],true);if(x.meterId!==undefined)id(x.meterId);if(typeof x.value!=='number'||!Number.isFinite(x.value)||x.value<0)bad();});
   if(k==='mydomHouseEvents')rows(v,x=>{id(x.id);text(x.title,true);fields(x,['street','type','service','start','end','description','source','sourceUrl','createdAt']);if(!x.scope&&!Array.isArray(x.houses))bad();if(x.houses!==undefined){if(!Array.isArray(x.houses))bad();x.houses.forEach(y=>text(y));}if(x.scope!==undefined&&!obj(x.scope))bad();});
   if(k==='mydomApartmentsV1'){
    if(nested||!obj(v)||!Array.isArray(v.homes)||v.homes.length>1000)bad();const ids=new Set();
    for(const h of v.homes){if(!obj(h))bad();id(h.id);if(ids.has(h.id))bad();ids.add(h.id);address(h.address);validate(h.data,true);if(!h.data.mydomAddress)bad();const a=JSON.parse(h.data.mydomAddress);if(!a||['street','house','apartment'].some(f=>a[f]!==h.address[f]))bad();}
    if(v.homes.length?!ids.has(v.active):v.active!==null)bad();
   }
  }
  if(!nested&&data.mydomApartmentsV1&&data.mydomAddress){const r=JSON.parse(data.mydomApartmentsV1),a=JSON.parse(data.mydomAddress),h=r.homes.find(h=>h.id===r.active);if(h&&(!a||['street','house','apartment'].some(k=>h.address[k]!==a[k])))bad();}
  return data;
 }
 function backup(input){if(!obj(input)||input.format!=='mydom-backup'||input.version!==1||!obj(input.data)||!Object.keys(input.data).length)bad();if(['mydomAddress','mydomAccounts','mydomManualBills','mydomApartmentsV1'].some(k=>!Object.hasOwn(input.data,k)))bad();return validate(input.data);}
 const api={keys,workspace,validate,backup};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BackupSchema=api;
})(globalThis);
