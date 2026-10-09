const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((q,r)=>{try{const name=path.join(root,q.url==='/'?'index.html':q.url);r.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html');r.end(fs.readFileSync(name));}catch(e){r.statusCode=404;r.end();}}).listen(8130);
 const browser=await chromium.launch({executablePath:process.env.QR_TEST_BROWSER||undefined,args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:8130');await p.waitForSelector('#apartmentSwitcher');await p.evaluate(()=>closeWelcome(false));
  assert(await p.locator('#apartmentSwitcher').isVisible());
  for(const section of ['bills','meters','accounts','homeinfo','more']){
   if(!await p.locator('#'+section).count())continue;
   await p.evaluate(id=>go(id),section);assert(!await p.locator('#apartmentSwitcher').isVisible(),section);
  }
  await p.evaluate(()=>go('home'));await p.locator('#addApartment').click();
  assert.equal(await p.locator('label[for=streetInput]').textContent(),'Улица');
  assert.equal(await p.locator('#innerStreet').count(),0);
  await p.locator('#streetInput').fill('Ленина');await p.getByRole('button',{name:'пр-кт Ленина',exact:true}).click();
  const houses=await p.locator('#houseSelect option').evaluateAll(xs=>xs.map(x=>x.value).filter(Boolean));
  const collator=new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
  assert.deepEqual(houses,[...houses].sort(collator.compare));
  assert(houses.includes('44е'));assert(houses.includes('12/20'));assert(!houses.some(x=>/^двлд|^зд/.test(x)));
  await p.locator('#houseSelect').selectOption('10');await p.locator('#apartmentInput').fill('25');
  await p.locator('#privateAddress').check();assert.equal(await p.locator('#apartmentInput').inputValue(),'');assert(await p.locator('#apartmentInput').isDisabled());
  await p.locator('#privateAddress').uncheck();assert.equal(await p.locator('#apartmentInput').inputValue(),'');assert(await p.locator('#apartmentInput').isEnabled());
  await p.locator('#apartmentInput').fill('25');await p.locator('#addressModal .actions .btn').last().click();
  // Existing workspace data must survive adding and switching homes.
  await p.evaluate(()=>localStorage.setItem('mydomWater','123'));
  await p.locator('#addApartment').click();await p.locator('#streetInput').fill('Труженик');await p.getByRole('button',{name:'сдт Труженик',exact:true}).click();
  await p.locator('#houseSelect').selectOption('562');await p.locator('#privateAddress').check();
  await Promise.all([p.waitForEvent('load'),p.locator('#addressModal .actions .btn').last().click()]);await p.waitForSelector('#apartmentSwitcher');
  assert.equal(await p.evaluate(()=>savedAddress.house),'562');assert.equal(await p.evaluate(()=>savedAddress.apartment),'');
  await p.locator('#addApartment').click();assert.equal(await p.locator('#houseSelect').inputValue(),'562');await p.evaluate(()=>closeAddress());
  const firstId=await p.locator('#activeApartment option').first().getAttribute('value');
  await Promise.all([p.waitForEvent('load'),p.locator('#activeApartment').selectOption(firstId)]);await p.waitForSelector('#apartmentSwitcher');
  assert.equal(await p.evaluate(()=>localStorage.getItem('mydomWater')),'123');assert.equal(await p.evaluate(()=>savedAddress.apartment),'25');
  await p.waitForFunction(()=>!!window.Management);await p.evaluate(()=>go('homeinfo'));
  await p.locator('#managementChoice').selectOption('0700029189');await p.locator('#saveManagement').click();
  assert.equal(await p.evaluate(()=>savedAddress.managementOverride.orgId),'0700029189');
  await p.reload();await p.waitForFunction(()=>!!window.Management&&!!document.getElementById('managementChoice'));
  assert.equal(await p.evaluate(()=>savedAddress.managementOverride.orgId),'0700029189');
  const otherId=await p.locator('#activeApartment option').nth(1).getAttribute('value');
  await Promise.all([p.waitForEvent('load'),p.locator('#activeApartment').selectOption(otherId)]);await p.waitForFunction(()=>!!window.Management&&!!document.getElementById('managementChoice'));
  assert.equal(await p.evaluate(()=>!!savedAddress.managementOverride),false);
  await Promise.all([p.waitForEvent('load'),p.locator('#activeApartment').selectOption(firstId)]);await p.waitForFunction(()=>!!window.Management&&!!document.getElementById('managementChoice'));
  assert.equal(await p.evaluate(()=>localStorage.getItem('mydomWater')),'123');
  await p.evaluate(()=>go('homeinfo'));await p.locator('#managementChoice').selectOption('');await p.locator('#saveManagement').click();assert.equal(await p.evaluate(()=>!!savedAddress.managementOverride),false);
  // Old nested addresses remain intact when reopened in the single street field.
  await p.evaluate(()=>{savedAddress={street:'сдт Горный Сад / Садовая',innerStreet:'Садовая',catalogCode:'legacy',house:'двлд12А',apartment:'',isPrivate:true};openAddress();});
  assert.equal(await p.locator('#streetInput').inputValue(),'сдт Горный Сад / Садовая');
  assert.equal(await p.locator('#manualHouse').inputValue(),'12А');
  const restored=await p.evaluate(()=>addressSelection());assert.equal(restored.street,'сдт Горный Сад / Садовая');assert.equal(restored.house,'12А');
  await p.locator('#streetInput').fill('Рублевская');await p.getByRole('button',{name:'ул. Рублёвская',exact:true}).click();
  await p.locator('#manualHouse').fill('12/1');assert.equal(await p.evaluate(()=>addressSelection().addressSource),'user');
  await p.evaluate(()=>closeAddress());
  for(const width of [320,360,390,414,1024]){
   await p.setViewportSize({width,height:844});
   for(const section of ['home','bills','meters','accounts','homeinfo']){
    await p.evaluate(id=>go(id),section);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),section+' '+width);
    assert.equal(await p.locator('#apartmentSwitcher').isVisible(),section==='home');
   }
   await p.evaluate(()=>openAddress());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.evaluate(()=>closeAddress());
  }
  await p.waitForFunction(()=>!!window.OutageMatcher);
  await p.evaluate(()=>{go('home');houseEvents=[{id:'synthetic-zone-test',title:'Проверка неопределённой зоны',scope:{city:'Нальчик',type:'polygon'},source:'Тест'}, {id:'synthetic-exact-test',title:'Проверка адреса',scope:{city:'Нальчик',type:'addresses',addresses:[{street:savedAddress.street,house:savedAddress.house}],complete:true},source:'Тест'}];renderHouseEvents();});
  assert(await p.getByText('Возможно, касается вашего дома',{exact:true}).isVisible());
  assert(await p.getByText('Ваш адрес указан',{exact:true}).isVisible());
  assert.equal(await p.evaluate(()=>houseEvents.some(eventMatches)),false);
  const feedPage=await browser.newPage();
  await feedPage.route('**/api/outages',route=>route.fulfill({json:{schemaVersion:1,checkedAt:new Date().toISOString(),sources:{power:{state:'ok',lastSuccessAt:new Date().toISOString()},water:{state:'error',lastSuccessAt:null}},events:[{id:'feed-test',source:'Тест',title:'Тестовый график',description:'Проверка карточки',start:new Date(Date.now()+3600000).toISOString(),scope:{city:'Нальчик',type:'streets',streets:['Ленина'],complete:true}}]}}));
  await feedPage.addInitScript(()=>{localStorage.setItem('mydomAddress',JSON.stringify({street:'Ленина',house:'12',apartment:'1'}));localStorage.setItem('mydomWelcomeDone','1');});
  await feedPage.goto('http://localhost:8130');await feedPage.getByText('Тестовый график',{exact:true}).waitFor();
  assert(await feedPage.getByText('В объявлении указана ваша улица; отдельные дома не уточнены.',{exact:true}).isVisible());
  assert.equal(await feedPage.getByText('Сведения об отключениях не подключены',{exact:true}).count(),0);
  assert(await feedPage.getByText(/Водоканал: ошибка загрузки/).isVisible());await feedPage.close();
  assert.deepEqual(errors,[]);console.log('PASS: home-only switcher, sorted clean numbers, suffixes, single street, checkbox clearing, Truzhenik 562, legacy nested address and workspace preservation, mobile/desktop widths');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
