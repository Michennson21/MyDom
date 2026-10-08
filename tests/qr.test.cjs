const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseReceiptQR,receiptQRText}=require('../qr.js');
test('payment sum uses kopeks and resident account keeps leading zeroes',()=>{
 const r=parseReceiptQR('ST00012|Name=Вода|PersonalAcc=40700000000000000000|Sum=123456|PersAcc=00012|PaymPeriod=09.2026');
 assert.equal(r.total,'1234.56');assert.equal(r.account,'00012');assert.equal(r.period,'09.2026');
});
test('bank account never substitutes for a missing resident account',()=>{
 const r=parseReceiptQR('ST00012|Name=Вода|PersonalAcc=40700000000000000000');
 assert.equal(r.account,'');assert.equal(r.total,'');assert.equal(r.period,'');
});
test('zero sum, field casing and equals signs in values',()=>{
 const r=parseReceiptQR('ST00012|Name=Вода|sum=0|persAcc=001|paymPeriod=0926|Purpose=a=b');
 assert.equal(r.total,'0.00');assert.equal(r.account,'001');assert.equal(r.purpose,'a=b');
});
test('unsupported, ambiguous and invalid inputs are rejected',()=>{
 for(const value of ['https://qr.nspk.ru/example','t=123&s=1&fn=2','ST00013|Name=X','ST00012|Name=X|Sum=-1','ST00012|Name=X|Sum=1.23','ST00012|Name=X|Sum=999999999999999999','ST00012|Name=X|Sum=1|Sum=2','ST00012|Sum=10','ST00012|Name=X|broken'])assert.throws(()=>parseReceiptQR(value));
});
test('UTF-8 and Windows-1251 Cyrillic QR payloads',()=>{
 const utf=Buffer.from('ST00012|Name=Вода');
 assert.equal(parseReceiptQR(receiptQRText({binaryData:utf})).recipient,'Вода');
 const cp=Buffer.concat([Buffer.from('ST00011|Name='),Buffer.from([194,238,228,224])]);
 assert.equal(parseReceiptQR(receiptQRText({binaryData:cp})).recipient,'Вода');
});
test('all application scripts parse',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 for(const file of ['qr.js','sw.js'])new vm.Script(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
});
