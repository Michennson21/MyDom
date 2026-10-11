// Synthetic data only. NODE_PATH points to Playwright; QR_TEST_BROWSER to Chromium.
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>{try{const f=path.join(root,q.url==='/'?'index.html':q.url);r.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(fs.readFileSync(f));}catch(_){r.statusCode=404;r.end();}}).listen(8160);
 const browser=await chromium.launch({executablePath:process.env.QR_TEST_BROWSER||undefined,args:['--no-sandbox']});
 try {
 const p=await browser.newPage({serviceWorkers:"block",viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('mydomWelcomeDone','1'));
 await p.goto('http://localhost:8160');await p.waitForFunction(()=>!!window.HomeDesign);
 await p.evaluate(()=>{const a={street:'ул. Тестовая',house:'1',apartment:'2'};localStorage.setItem('mydomAddress',JSON.stringify(a));localStorage.setItem('mydomAccounts',JSON.stringify([{provider:'Водоканал',number:'00123'}]));localStorage.setItem('mydomMeterHistory',JSON.stringify([{id:'old',addressKey:JSON.stringify([a.street,a.house,a.apartment]),provider:'Водоканал',account:'00123',meter:'W001',kind:'Холодная вода',value:100,createdAt:'2026-01-01T00:00:00Z'}]));});
 await p.reload();await p.waitForFunction(()=>!!window.HomeDesign);await p.evaluate(()=>go('meters'));

 // The same imported history may arrive in arbitrary order.
 await p.evaluate(async()=>{const rows=JSON.parse(localStorage.getItem('mydomMeterHistory'));rows.push({...rows[0],id:'newer',value:150,createdAt:'2026-02-01T00:00:00Z'});await SafeStore.commit({mydomMeterHistory:JSON.stringify(rows)});MeterReadings.reload();});
 await p.locator('#meterNumber').fill('W001');await p.locator('#meterValue').fill('125');await p.locator('#saveMeterReading').click();assert.match(await p.locator('#meterFeedback').innerText(),/меньше предыдущего/);
 assert.match(await p.locator('#meterHistory .card').first().innerText(),/150/);
 assert.equal(await p.locator('#meterKind').inputValue(),'Холодная вода');assert(await p.locator('#meterKind').isDisabled());
 await p.getByRole('button',{name:'Создать карточку из истории: Холодная вода · W001',exact:true}).click();await p.locator('#passport-installed').fill('2199-01-01');await p.getByRole('button',{name:'Сохранить счётчик',exact:true}).click();assert.match(await p.locator('#passportError').innerText(),/не может быть в будущем/);await p.locator('#passport-installed').fill('');await p.getByRole('button',{name:'Сохранить счётчик',exact:true}).click();await p.locator('#meterPassportModal').waitFor({state:'hidden'});
 const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('mydomMetersV1'))[0].id);assert.equal(await p.evaluate(id=>MeterRegistry.previous(id).value,id),150);
 // Editing a serial repeatedly preserves legacy reading links.
 for(const serial of ['W002','W003']){await p.getByRole('button',{name:'Изменить данные / отметить поверку',exact:true}).click();await p.locator('#passport-serial').fill(serial);await p.getByRole('button',{name:'Сохранить счётчик',exact:true}).click();await p.locator('#meterPassportModal').waitFor({state:'hidden'});}
 assert.equal(await p.evaluate(id=>MeterRegistry.previous(id).value,id),150);
 assert(await p.evaluate(id=>JSON.parse(localStorage.getItem('mydomMeterHistory')).every(r=>r.meterId===id),id));
 await p.getByRole('button',{name:'Внести показание',exact:true}).click();assert(await p.locator('#meterNumber').isDisabled());assert(await p.locator('#meterAccount').isDisabled());await p.locator('#meterValue').fill('151');
 await p.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await p.locator('#meterValue').inputValue(),'151');assert.equal(await p.locator('#registeredMeter').inputValue(),id);
 await p.locator('#registeredMeter').selectOption('');assert.equal(await p.locator('#meterNumber').isDisabled(),false);await p.locator('#meterNumber').fill('W003');await p.locator('#meterValue').fill('151');await p.locator('#saveMeterReading').click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('mydomMeterHistory'))[0].value===151);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mydomMeterHistory'))[0].meterId),id);
 await p.getByRole('button',{name:'Изменить данные / отметить поверку',exact:true}).click();await p.locator('#passport-status').selectOption('archived');await p.getByRole('button',{name:'Сохранить счётчик',exact:true}).click();await p.locator('#meterPassportModal').waitFor({state:'hidden'});await p.locator('#meterNumber').fill('W003');await p.locator('#meterValue').fill('152');await p.locator('#saveMeterReading').click();assert.match(await p.locator('#meterFeedback').innerText(),/в архиве/);
 assert.deepEqual(errors,[]);console.log('PASS: chronological readings, provider kind, future dates, repeated corrections, draft retention, manual linking, archived meter protection');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
