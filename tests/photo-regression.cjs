// Optional browser regression: npm install --no-save playwright qrcode pngjs
// npx playwright install chromium && node tests/photo-regression.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const QRCode=require('qrcode');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');
const raw='ST00012|Name=Тестовый водоканал|PersonalAcc=40702810000000000001|BankName=Тестовый банк|BIC=044525225|PayeeINN=7700000000|Sum=123456|PersAcc=00001234|PaymPeriod=09.2026|PayerAddress=Нальчик, Мальбахова, 17, кв. 1|Purpose=Вода';
(async()=>{
 const tinyBuffer=await QRCode.toBuffer(raw,{scale:2,margin:4,errorCorrectionLevel:'M'});
 const tiny=PNG.sync.read(tinyBuffer),large=new PNG({width:6000,height:4000});large.data.fill(255);
 PNG.bitblt(tiny,large,0,0,tiny.width,tiny.height,3200,2150);const photo=PNG.sync.write(large);
 const server=http.createServer((req,res)=>{try{
  if(req.url==='/fixture.png'){res.setHeader('Content-Type','image/png');res.end(photo);return;}
  const name=req.url==='/'?'index.html':req.url.slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))throw Error('path');
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 }catch(e){res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.QR_TEST_BROWSER?{executablePath:process.env.QR_TEST_BROWSER}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const before=await page.evaluate(async()=>{const img=new Image();img.src='/fixture.png';await img.decode();const c=document.createElement('canvas');c.width=2000;c.height=Math.round(img.height*2000/img.width);const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);const p=ctx.getImageData(0,0,c.width,c.height);return !!jsQR(p.data,p.width,p.height,{inversionAttempts:'attemptBoth'});});
  assert.equal(before,false,'fixture must reproduce the previous detector failure');
  await page.evaluate(()=>openQR());await page.locator('#qrPhoto').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:photo});
  await page.locator('#qrAccount').waitFor({timeout:30000});assert.equal(await page.locator('#qrAccount').inputValue(),'00001234');assert.equal(await page.locator('#qrTotal').inputValue(),'1234,56');
  await page.evaluate(()=>{closeQR();openQR();window.savedDecoder=jsQR;window.jsQR=()=>null;});
  await page.locator('#qrPhoto').setInputFiles({name:'qr.png',mimeType:'image/png',buffer:tinyBuffer});await page.locator('#qrAccount').waitFor({timeout:30000});assert.ok((await page.locator('#qrResult').innerText()).includes('Тестовый водоканал'));
  await page.evaluate(()=>{jsQR=window.savedDecoder;closeQR();openQR();});
  await page.locator('#qrPhoto').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:photo});await page.evaluate(()=>closeQR());await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>qrDraft),null);assert.deepEqual(errors,[]);
  console.log('PASS: reproduced old failure; new multi-pass photo detection; Cyrillic fallback; cancellation');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
