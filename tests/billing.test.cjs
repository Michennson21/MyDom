const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../billing.js');
test('strict integer-kopek amounts, including zero, spaces and optional fields',()=>{
 for(const [raw,want]of [['0',0],['0,01',1],['1 234,56',123456],['1\u00a0234.50',123450],['0.29',29]])assert.equal(B.money(raw),want);
 assert.equal(B.money('',true),0);
 for(const raw of ['','abc','-1','1e3','1,234','1.2.3','1 2','12 ₽','Infinity','1000000000'])assert.throws(()=>B.money(raw));
});
test('canonical periods, rejecting ambiguity',()=>{
 for(const raw of ['10.2026','2026-10','102026','октябрь 2026','октября 2026 г.'])assert.equal(B.period(raw),'2026-10');
 for(const raw of ['13.2026','00.2026','сентябрь-октябрь 2026','10/26','01.10.2026','2026','не знаю'])assert.equal(B.period(raw),null);
});
const bill=(id,period,total=100,account='A')=>({id,provider:'Водоканал',account,period,total,paid:0});
test('latest by period per account, regardless of import order; no historical double-count',()=>{
 const r=B.summary([bill(2,'01.2025',250),{...bill(1,'октябрь 2026',1000.10),paid:200.05},bill(3,'09.2026',300,'B')]);
 assert.equal(r.total,110005);assert.deepEqual(r.latest.map(x=>x.id),[1,3]);
 assert.equal(B.summary([{...bill(1,'10.2026',1),paid:2}]).total,0);
});
test('unknown periods, duplicate latest months and invalid amounts cannot silently produce a total',()=>{
 for(const rows of [[bill(1,'не знаю')],[bill(1,'10.2026'),bill(2,'2026-10')],[bill(1,'10.2026',-1)]]){const r=B.summary(rows);assert.equal(r.issues.length,1);assert.equal(r.latest.length,0);}
 assert(B.duplicate([bill(1,'октябрь 2026')],bill(2,'2026-10')));assert(!B.duplicate([bill(1,'10.2026')],bill(1,'2026-10'),1));assert(!B.duplicate([bill(1,'10.2026')],bill(2,'10.2026',100,'B')));
});
test('rename links account, bills, readings, meter identities and complaint metadata; preserves source documents',()=>{
 const a={provider:'Водоканал',account:'001'},data={mydomAccounts:JSON.stringify([{provider:a.provider,number:a.account}]),mydomManualBills:JSON.stringify([{...a,qrRaw:'original',qrFields:{persacc:'001'}}]),mydomMeterHistory:JSON.stringify([a]),mydomMetersV1:JSON.stringify([{...a,readingIdentity:a}]),mydomResidentIssues:JSON.stringify([{...a,routeAccount:'001',documentText:'Лицевой счёт: 001'}])};
 const next=B.rename(data,'Водоканал','001','002');assert.equal(JSON.parse(next.mydomAccounts)[0].number,'002');
 for(const k of ['mydomManualBills','mydomMeterHistory','mydomMetersV1','mydomResidentIssues'])assert.equal(JSON.parse(next[k])[0].account,'002');
 assert.equal(JSON.parse(next.mydomMetersV1)[0].readingIdentity.account,'002');assert.equal(JSON.parse(next.mydomManualBills)[0].qrFields.persacc,'001');assert.equal(JSON.parse(next.mydomResidentIssues)[0].documentText,'Лицевой счёт: 001');assert.equal(JSON.parse(data.mydomAccounts)[0].number,'001');
});
