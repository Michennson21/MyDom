// Synthetic data only. Run with NODE_PATH and QR_TEST_BROWSER as for issues.browser.cjs.
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>{try{const f=path.join(root,q.url==='/'?'index.html':q.url);r.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(fs.readFileSync(f));}catch(_){r.statusCode=404;r.end();}}).listen(8143);
 const browser=await chromium.launch({executablePath:process.env.QR_TEST_BROWSER||undefined,args:['--no-sandbox']});
 try {
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('mydomWelcomeDone','1'));
 await p.goto('http://localhost:8143');await p.waitForFunction(()=>!!window.IssueGuide);
 await p.evaluate(()=>{savedAddress={street:'ул. Тестовая',house:'1',apartment:'2',managementOverride:{name:'ООО Тестовая УК'}};accounts=[{provider:'Водоканал',number:'00123'}];manualBills=[{provider:'Водоканал',account:'00123',qrFields:{name:'ООО Тестовый водоканал'}}];go('issues');openIssueFlow();});
 const click=async name=>p.locator('#issueStep').getByRole('button',{name,exact:true}).click();
 const start=async()=>p.evaluate(()=>openIssueFlow());
 const flow=async(...names)=>{await start();for(const name of names)await click(name);};
 assert(await p.getByRole('heading',{name:'Что случилось?',exact:true}).isVisible());assert.equal(await p.locator('#issueRecipient').count(),0);
 await click('Нужен перерасчёт');await click('Холодная вода');await click('Не учтены показания счётчика');await click('Отдельный поставщик услуги');await click('Подготовить: Водоканал');
 assert.equal(await p.locator('#issueRecipient').inputValue(),'ООО Тестовый водоканал');assert.equal(await p.locator('#issueAccount').inputValue(),'00123');
 assert.equal(await p.locator('#issueAttachments').inputValue(),'');
 const photo=p.getByRole('checkbox',{name:/Фото счётчика с показаниями/});await photo.check();await p.locator('#issueAttachments').fill((await p.locator('#issueAttachments').inputValue())+'\nМой акт');await photo.uncheck();assert.equal(await p.locator('#issueAttachments').inputValue(),'Мой акт');await photo.check();
 await p.locator('#issueApplicant').fill('Тестовый Иван Иванович');await p.locator('#issueReply').fill('test@example.test');await p.locator('#issueText').fill('Мой личный рассказ не для документа');await click('Подготовить текст');
 const text=await p.locator('#issueDocument').inputValue();assert(text.includes('возможность их использования'));assert(text.includes('Услуга: Холодная вода'));assert(text.includes('Фото счётчика'));assert(!text.includes('Квитанция за спорный период'));assert(!text.includes('Мой личный рассказ'));
 await click('Сохранить обращение');assert.equal(await p.evaluate(()=>residentIssues[0].guide.reason),'readings');
 // Question history restores the correct earlier choices, not stale branches.
 await flow('Проблема со счётчиком','Холодная вода','Вопрос о поверке');await click('← Назад');await click('Не работает или повреждён');await click('Подготовить: Водоканал');assert(await p.getByRole('checkbox',{name:/Фото видимого дефекта/}).isVisible());assert.equal(await p.getByRole('checkbox',{name:/Аршин/}).count(),0);
 await flow('Проблема со счётчиком','Холодная вода','Вопрос о поверке','Подготовить: Водоканал');await p.locator('.issue-evidence').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/mydom-evidence.png'});assert(await p.getByRole('checkbox',{name:/Аршин/}).isVisible());assert.equal(await p.getByRole('checkbox',{name:/Фото видимого дефекта/}).count(),0);
 await flow('Нужен перерасчёт','Холодная вода','Перебой или плохое качество услуги','Управляющая компания / ТСЖ','Подготовить: ООО Тестовая УК');assert.equal(await p.locator('#issueRecipient').inputValue(),'ООО Тестовая УК');assert(await p.getByRole('checkbox',{name:/Акт проверки качества/}).isVisible());
 await flow('Нет услуги или плохое качество','Холодная вода','Не знаю','Подготовить: ООО Тестовая УК');assert.equal(await p.locator('#issueRecipient').inputValue(),'ООО Тестовая УК');
 await flow('Неверное начисление','Холодная вода','Отдельный поставщик услуги','Указать другую организацию');assert.equal(await p.locator('#issueRecipient').inputValue(),'');assert.equal(await p.locator('#issueAccount').inputValue(),'');
 // Multiple accounts require an explicit selection; unmatched providers stay blank.
 await p.evaluate(()=>accounts.push({provider:'Водоканал',number:'00999'}));
 await flow('Не учтён платёж','Холодная вода','Отдельный поставщик услуги');assert.equal(await p.locator('#issueRecipient').count(),0);await click('Водоканал · счёт 00999');assert.equal(await p.locator('#issueAccount').inputValue(),'00999');assert(await p.getByRole('checkbox',{name:/Чек или подтверждение платежа/}).isVisible());
 await flow('Нужен перерасчёт','Вывоз мусора','Временное отсутствие','Отдельный поставщик услуги','Продолжить и указать адресата');assert.equal(await p.locator('#issueRecipient').inputValue(),'');assert(await p.getByRole('checkbox',{name:/Документы о периоде отсутствия/}).isVisible());assert.equal(await p.getByRole('checkbox',{name:/Акт об отсутствии технической/}).count(),0);
 await flow('Нужен перерасчёт','Холодная вода','Временное отсутствие','Отдельный поставщик услуги','Водоканал · счёт 00123');assert(await p.getByRole('checkbox',{name:/Акт об отсутствии технической/}).isVisible());
 // Recommendations are optional, so a person without documents can still prepare a request.
 await p.locator('#issueApplicant').fill('Тестовый Иван Иванович');await p.locator('#issueReply').fill('test@example.test');await p.locator('#issueText').fill('Описание');await click('Подготовить текст');assert(!(await p.locator('#issueDocument').inputValue()).includes('Приложения ('));
 for(const width of [320,390,1024]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.reload();await p.waitForFunction(()=>!!window.IssueGuide);assert.equal(await p.evaluate(()=>residentIssues[0].guide.reason),'readings');
 assert.deepEqual(errors,[]);console.log('PASS: problem-first questions, routing, multiple accounts, unknown recipient, contextual documents, opt-in attachments, no raw description, save/reload, no-documents flow, mobile widths');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
