/* Local meter history. No transmission or payment is performed. */
(function(){
 const key='mydomMeterHistory';let records=[];try{records=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(records))records=[];}catch(e){}
 const addressKey=()=>savedAddress?JSON.stringify([savedAddress.street,savedAddress.house,savedAddress.apartment]):'';
 const readingAccounts=()=>accounts;
 const section=document.getElementById('meters');
 function render(){
 const available=readingAccounts();
 section.innerHTML='<div class="page-heading"><div><div class="eyebrow">УЧЁТ ПОТРЕБЛЕНИЯ</div><h1>Счётчики и показания</h1><p>Храните данные приборов, следите за сроками и показаниями воды, газа, электричества и тепла.</p></div></div><div class="local-note">Сохранено в приложении — не значит отправлено поставщику. Данные остаются в этом браузере.</div><div class="card"><div class="title">Новое показание</div>'+(!savedAddress?'<p>Сначала выберите адрес квартиры.</p><button class="btn" onclick="openAddress()">Выбрать адрес</button>':!available.length?'<p>Добавьте лицевой счёт поставщика услуги.</p><button class="btn" onclick="openAccount()">Добавить лицевой счёт</button>':'<p class="muted">'+escapeHtml(savedAddress.street+', '+savedAddress.house+', кв. '+savedAddress.apartment)+'</p><label class="formlabel" for="meterAccount">Лицевой счёт</label><select id="meterAccount" class="input">'+available.map((a,i)=>'<option value="'+i+'">'+escapeHtml(a.provider+' · '+a.number)+'</option>').join('')+'</select><label class="formlabel" for="meterKind">Услуга</label><select id="meterKind" class="input"><option>Холодная вода</option><option>Горячая вода</option><option>Газ</option><option>Электроэнергия</option><option>Тепло</option></select><label class="formlabel" for="meterNumber">Номер счётчика *</label><input id="meterNumber" class="input" placeholder="Номер на корпусе или в квитанции"><label class="formlabel" for="meterValue">Текущее показание, м³ *</label><input id="meterValue" class="input" inputmode="decimal" placeholder="Например, 125,430"><div id="extraTariffFields"></div><p class="muted">Введите полное значение счётчика, а не расход за месяц. Для газа, электричества и тепла сначала добавьте карточку прибора и выберите её в поле «Сохранённый счётчик».</p><div id="meterFeedback" role="status" tabindex="-1"></div><button class="btn block" id="saveMeterReading">Сохранить показание</button>')+'</div><h2 class="list-heading">История показаний</h2><div id="meterHistory"></div>';
 document.getElementById('saveMeterReading')?.addEventListener('click',save);
 const acc=document.getElementById('meterAccount');if(acc){acc.addEventListener('change',syncKind);syncKind();}
 renderHistory();window.MeterRegistry?.render();
 }
 function syncKind(){const a=readingAccounts()[Number(document.getElementById('meterAccount').value)];const kind=document.getElementById('meterKind');kind.value=a?.provider==='Водоканал'?'Холодная вода':a?.provider==='Нальчикская теплоснабжающая компания'?'Горячая вода':/газ/i.test(a?.provider)?'Газ':'Электроэнергия';kind.disabled=true;configure();}
 function configure(profile){const m=profile||{kind:document.getElementById('meterKind').value},n=MeterValues.count(m),unit=MeterValues.unit(m);document.querySelector('label[for="meterValue"]').textContent=(n>1?'Т1':'Текущее показание')+', '+unit+' *';const box=document.getElementById('extraTariffFields');box.replaceChildren();for(let i=2;i<=n;i++){const l=document.createElement('label');l.className='formlabel';l.htmlFor='meterValueT'+i;l.textContent='Т'+i+', '+unit+' *';const input=document.createElement('input');input.id=l.htmlFor;input.className='input';input.inputMode='decimal';box.append(l,input);} }
 function ordered(rows){return [...rows].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));}
 function feedback(message){const box=document.getElementById('meterFeedback');box.className='notice';box.textContent=message;box.focus();}
 function difference(r,history){const index=history.indexOf(r),prior=history.slice(index+1).find(x=>r.meterId&&x.meterId?r.meterId===x.meterId:x.provider===r.provider&&x.account===r.account&&x.meter===r.meter&&x.kind===r.kind);const delta=MeterValues.delta(r,prior);return delta?'<p class="muted">Расход между показаниями: '+escapeHtml(delta)+'</p>':'';}
 function renderHistory(){const history=ordered(records.filter(r=>r.addressKey===addressKey()));const box=document.getElementById('meterHistory');box.innerHTML=history.length?history.map(r=>'<div class="card"><div class="row"><div class="grow"><div class="title">'+escapeHtml(r.kind)+'</div><div class="muted">'+escapeHtml(r.provider)+' · Л/с '+escapeHtml(r.account)+'</div><div class="muted">Счётчик '+escapeHtml(r.meter)+'</div></div><b class="service-total">'+escapeHtml(MeterValues.format(r))+'</b></div><p class="muted">'+new Date(r.createdAt).toLocaleString('ru-RU')+'</p>'+difference(r,history)+'<span class="pill userdata">Не отправлено поставщику</span><button class="linkbtn danger" style="margin-left:10px" data-remove-reading="'+escapeHtml(r.id)+'">Удалить</button></div>').join(''):'<div class="card empty">Для этой квартиры пока нет показаний.</div>';
 box.querySelectorAll('[data-remove-reading]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Удалить эту запись показания?'))return;const next=records.filter(r=>r.id!==b.dataset.removeReading);try{await SafeStore.commit({[key]:JSON.stringify(next)});records=next;renderHistory();window.MeterRegistry?.render();}catch(e){alert('Не удалось удалить запись. Данные не изменены.');}}));
 const legacy=localStorage.getItem('mydomWater');if(legacy!==null){const note=document.createElement('div');note.className='card';note.textContent='Ранее сохранённое значение: '+legacy+' м³. У него нет привязки к счётчику, адресу и дате. При необходимости внесите новую запись.';box.append(note);}
 }
 async function save(){
 const account=readingAccounts()[Number(document.getElementById('meterAccount').value)],meter=document.getElementById('meterNumber').value.trim(),kind=document.getElementById('meterKind').value;
 if(!account||!savedAddress){feedback('Выберите адрес и лицевой счёт.');return;}
 if(!meter){feedback('Укажите номер счётчика, чтобы вести отдельную историю.');return;}
 if(['Холодная вода','Горячая вода'].includes(kind)&&kind!==(account.provider==='Водоканал'?'Холодная вода':'Горячая вода')){feedback('Вид воды не соответствует выбранному лицевому счёту.');return;}
 const linked=window.MeterRegistry?.resolve({provider:account.provider,account:account.number,serial:meter,kind});
 if(linked?.status==='archived'){feedback('Этот счётчик в архиве. Для нового прибора создайте новую карточку.');return;}
 const selected=document.getElementById('registeredMeter')?.value;
 const profile=selected?window.MeterRegistry?.get(selected):linked;
 if(selected&&(!profile||profile.provider!==account.provider||profile.account!==account.number||profile.serial!==meter||profile.kind!==kind)){feedback('Данные не совпадают с выбранным счётчиком. Выберите его заново.');return;}
 if(!['Холодная вода','Горячая вода'].includes(kind)&&!selected){feedback('Выберите сохранённую карточку счётчика. Для электричества и тепла сначала укажите тарифы и единицы в карточке.');return;}
 if(profile&&!MeterValues.eligible(profile)){feedback('Прибор недоступен для показаний. Для тепла подтвердите индивидуальный прибор учёта.');return;}
 const meterId=profile?.id,m=profile||{kind};let tariffs={};try{for(let i=1;i<=MeterValues.count(m);i++)tariffs['T'+i]=MeterValues.parse(document.getElementById(i===1?'meterValue':'meterValueT'+i).value);}catch(e){feedback(e.message);return;}
 const previous=(meterId?window.MeterRegistry?.previous(meterId):null)||ordered(records).find(r=>r.addressKey===addressKey()&&r.provider===account.provider&&r.account===account.number&&r.meter===meter&&r.kind===kind);
 const value=Object.values(tariffs).reduce((s,v)=>s+Math.round(v*1000),0)/1000;
 const record={id:crypto.randomUUID(),addressKey:addressKey(),provider:account.provider,account:account.number,meter,meterId,kind,value,unit:MeterValues.unit(m),tariffCount:MeterValues.count(m),...(MeterValues.count(m)>1?{tariffs}:{}),createdAt:new Date().toISOString(),status:'local'};
 try{MeterValues.check(record,previous);}catch(e){feedback(e.message);return;}
 if(previous&&Object.entries(tariffs).every(([k,v])=>MeterValues.values(previous)[k]===v)&&!confirm('Значение совпадает с предыдущим. Сохранить повторное показание?'))return;
 const next=[record,...records];
 try{await SafeStore.commit({[key]:JSON.stringify(next)});}catch(e){feedback('Не удалось сохранить в браузере. Запись не добавлена.');return;}
 records=next;for(const id of ['meterValue','meterValueT2','meterValueT3'])if(document.getElementById(id))document.getElementById(id).value='';feedback('Показание сохранено в приложении. Поставщику не отправлено.');
 renderHistory();window.MeterRegistry?.render();
 }
 window.MeterReadings={configure,reload:()=>{records=JSON.parse(localStorage.getItem(key)||'[]');render();}};
 const previousGo=go;go=function(id){if(id==='meters')render();previousGo(id);};
 const previousRenderAll=renderAll;renderAll=function(){previousRenderAll();if(section.classList.contains('active'))render();};
 const previousSaveAccount=saveAccount;saveAccount=async function(){await previousSaveAccount();render();};
 render();
})();
