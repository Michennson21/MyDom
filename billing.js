/* Pure receipt/account rules. Amounts are checked as integer kopeks. */
(function(root){
 const MAX=99999999999;
 function money(raw,optional=false){
  const value=String(raw??'').trim();
  if(!value){if(optional)return 0;throw Error('Укажите сумму.');}
  if(!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(value))throw Error('Введите неотрицательную сумму: например, 1 250,50. Не более двух знаков после запятой.');
  const parts=value.replace(/[ \u00a0\u202f]/g,'').replace(',','.').split('.');
  const cents=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents>MAX)throw Error('Сумма слишком велика. Проверьте квитанцию.');
  return cents;
 }
 function period(raw){
  const s=String(raw??'').trim().toLowerCase().replace(/\s+/g,' ').replace(/\s*г(?:од(?:а)?)?\.?$/,'');
  let y,m,a=s.match(/^(\d{4})-(\d{2})$/);
  if(a){y=+a[1];m=+a[2];}
  else if(a=s.match(/^(\d{1,2})[./-](\d{4})$/)){m=+a[1];y=+a[2];}
  else if(a=s.match(/^(\d{2})(\d{4})$/)){m=+a[1];y=+a[2];}
  else if(a=s.match(/^([а-яё]+) (\d{4})$/)){
   const names=[['январь','января'],['февраль','февраля'],['март','марта'],['апрель','апреля'],['май','мая'],['июнь','июня'],['июль','июля'],['август','августа'],['сентябрь','сентября'],['октябрь','октября'],['ноябрь','ноября'],['декабрь','декабря']];
   m=names.findIndex(x=>x.includes(a[1]))+1;y=+a[2];
  }
  return y>=1900&&y<=2199&&m>=1&&m<=12?String(y)+'-'+String(m).padStart(2,'0'):null;
 }
 const label=raw=>{const p=period(raw);return p?p.slice(5)+'.'+p.slice(0,4):String(raw||'Период не указан');};
 const key=b=>JSON.stringify([b.provider,b.account]);
 function groups(bills){const map=new Map();for(const b of bills){const k=key(b);if(!map.has(k))map.set(k,[]);map.get(k).push(b);}return [...map.values()].map(rows=>rows.slice().sort((a,b)=>(period(b.period)||'').localeCompare(period(a.period)||'')));}
 function summary(bills){
  const latest=[],issues=[];
  for(const rows of groups(bills)){
   const b=rows[0];let reason='';
   if(rows.some(x=>!period(x.period)))reason='Уточните расчётный период';
   else if(rows.filter(x=>period(x.period)===period(b.period)).length>1)reason='Повторные квитанции за один период';
   else try{money(b.total);money(b.paid??0);}catch(_){reason='Проверьте суммы в квитанции';}
   if(reason)issues.push({provider:b.provider,account:b.account,reason});else latest.push(b);
  }
  return {latest,issues,total:latest.reduce((sum,b)=>sum+Math.max(0,money(b.total)-money(b.paid??0)),0)};
 }
 function duplicate(bills,b,exceptId=null){const p=period(b.period);return p&&bills.some(x=>x.id!==exceptId&&x.provider===b.provider&&x.account===b.account&&period(x.period)===p);}
 function problem(b,bills){
  if(!period(b.period))return 'Уточните расчётный период этой квитанции.';
  try{for(const k of ['total','paid','accrued','debt'])money(b[k]??0);}catch(_){return 'Проверьте суммы этой квитанции.';}
  if(duplicate(bills,b,b.id))return 'Повторная квитанция по этому счёту за тот же месяц.';
  return '';
 }
 function nextId(bills){const used=new Set(bills.map(x=>x.id));let id=Date.now();while(used.has(id))id++;return id;}
 function rename(data,provider,oldNumber,newNumber){
  const out={...data},renameRow=x=>x.provider===provider&&x.account===oldNumber?{...x,account:newNumber}:x;
  for(const k of ['mydomManualBills','mydomMeterHistory','mydomMetersV1','mydomResidentIssues']){
   if(data[k]==null)continue;
   const rows=JSON.parse(data[k]).map(x=>{
    const n=renameRow(x);
    if(k==='mydomMetersV1'&&x.readingIdentity)return {...n,readingIdentity:renameRow(x.readingIdentity)};
    if(k==='mydomResidentIssues'&&n!==x&&x.routeAccount===oldNumber)return {...n,routeAccount:newNumber};
    return n;
   });out[k]=JSON.stringify(rows);
  }
  out.mydomAccounts=JSON.stringify(JSON.parse(data.mydomAccounts||'[]').map(a=>a.provider===provider&&a.number===oldNumber?{...a,number:newNumber}:a));
  // Keep raw QR payloads and saved complaint text as the original documents.
  return out;
 }
 const api={money,period,label,key,groups,summary,duplicate,problem,nextId,rename};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Billing=api;
})(globalThis);
