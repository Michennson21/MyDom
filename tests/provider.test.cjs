const {test}=require('node:test');const assert=require('node:assert/strict');const {detectQRProvider}=require('../qr.js');
const providers=['Экотехпром','Нальчикская теплоснабжающая компания','Водоканал','Другое','Управляющая компания'];
const detect=(name,inn='')=>detectQRProvider({recipient:name,fields:{payeeinn:inn}},providers);
test('receipt INNs and legal name variants map to the existing service',()=>{assert.equal(detect('МУП «ЭКОТЕХПРОМ»','0726008909').provider,'Экотехпром');assert.equal(detect('ООО "НТС"','0700005477').provider,providers[1]);assert.equal(detect('МУП «ЭКОТЕХПРОМ»').provider,'Экотехпром');assert.equal(detect('  ООО "НТС"  ').provider,providers[1]);});
test('unknown, conflicting and generic recipients remain manual',()=>{assert.equal(detect('Новый поставщик'),null);assert.equal(detect('Экотехпром','1234567890'),null);assert.equal(detect('НТС','0726008909'),null);assert.equal(detect('Управляющая компания'),null);assert.equal(detect('Не Экотехпром'),null);});
