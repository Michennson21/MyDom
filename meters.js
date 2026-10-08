/* Local meter history. No transmission or payment is performed. */
(function(){
 const key='mydomMeterHistory';let records=[];try{records=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(records))records=[];}catch(e){}
 const addressKey=()=>savedAddress?JSON.stringify([savedAddress.street,savedAddress.house,savedAddress.apartment]):'';
 const waterAccounts=()=>accounts.filter(a=>['Водоканал','Нальчикская теплоснабжающая компания'].includes(a.provider));
 const section=document.getElementById('meters');
 function render(){
 const available=waterAccounts();
 section.innerHTML='<div class="page-heading"><div><div class="eyebrow">УЧЁТ ПОТРЕБЛЕНИЯ</div><h1>Показания воды</h1><p>Сохраняйте значения и сверяйтесь с историей.</p></div></div><div class="local-note">Сохранено в приложении — не значит отправлено поставщику. Данные остаются в этом браузере.</div><div class="card"><div class="title">Новое показание</div>'+(!savedAddress?'<p>Сначала выберите адрес квартиры.</p><button class="btn" onclick="openAddress()">Выбрать адрес</button>':!available.length?'<p>Добавьте лицевой счёт водоканала или теплоснабжающей организации.</p><button class="btn" onclick="openAccount()">Добавить лицевой счёт</button>':'<p class="muted">'+escapeHtml(savedAddress.street+', '+savedAddress.house+', кв. '+savedAddress.apartment)+'</p><label class="formlabel" for="meterAccount">Лицевой счёт</label><select id="meterAccount" class="input">'+available.map((a,i)=>'<option value="'+i+'">'+escapeHtml(a.provider+' · '+a.number)+'</option>').join('')+'</select><label class="formlabel" for="meterKind">Вид воды</label><select id="meterKind" class="input"><option>Холодная вода</option><option>Горячая вода</option></select><label class="formlabel" for="meterNumber">Номер счётчика *</label><input id="meterNumber" class="input" placeholder="Номер на корпусе или в квитанции"><label class="formlabel" for="meterValue">Текущее показание, м³ *</label><input id="meterValue" class="input" inputmode="decimal" placeholder="Например, 125,430"><p class="muted">Введите полное значение счётчика, а не расход за месяц.</p><div id="meterFeedback" role="status" tabindex="-1"></div><button class="btn block" id="saveMeterReading">Сохранить показание</button>')+'</div><h2 class="list-heading">История показаний</h2><div id="meterHistory"></div>';
 document.getElementById('saveMeterReading')?.addEventListener('click',save);
 renderHistory();
 }
 function feedback(message){const box=document.getElementById('meterFeedback');box.className='notice';box.textContent=message;box.focus();}
 function renderHistory(){const history=records.filter(r=>r.addressKey===addressKey());const box=document.getElementById('meterHistory');box.innerHTML=history.length?history.map(r=>'<div class="card"><div class="row"><div class="grow"><div class="title">'+escapeHtml(r.kind)+'</div><div class="muted">'+escapeHtml(r.provider)+' · Л/с '+escapeHtml(r.account)+'</div><div class="muted">Счётчик '+escapeHtml(r.meter)+'</div></div><b class="service-total">'+Number(r.value).toLocaleString('ru-RU',{maximumFractionDigits:3})+' м³</b></div><p class="muted">'+new Date(r.createdAt).toLocaleString('ru-RU')+'</p><span class="pill userdata">Не отправлено поставщику</span><button class="linkbtn danger" style="margin-left:10px" data-remove-reading="'+escapeHtml(r.id)+'">Удалить</button></div>').join(''):'<div class="card empty">Для этой квартиры пока нет показаний.</div>';
 box.querySelectorAll('[data-remove-reading]').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Удалить эту запись показания?'))return;const next=records.filter(r=>r.id!==b.dataset.removeReading);try{localStorage.setItem(key,JSON.stringify(next));records=next;renderHistory();}catch(e){alert('Не удалось удалить запись. Данные не изменены.');}}));
 const legacy=localStorage.getItem('mydomWater');if(legacy!==null){const note=document.createElement('div');note.className='card';note.textContent='Ранее сохранённое значение: '+legacy+' м³. У него нет привязки к счётчику, адресу и дате. При необходимости внесите новую запись.';box.append(note);}
 }
 function save(){
 const account=waterAccounts()[Number(document.getElementById('meterAccount').value)],meter=document.getElementById('meterNumber').value.trim(),kind=document.getElementById('meterKind').value,raw=document.getElementById('meterValue').value.trim().replace(',','.');
 if(!account||!savedAddress){feedback('Выберите адрес и лицевой счёт.');return;}
 if(!meter){feedback('Укажите номер счётчика, чтобы вести отдельную историю.');return;}
 if(!/^\d+(\.\d{1,3})?$/.test(raw)||!Number.isSafeInteger(Math.round(Number(raw)*1000))){feedback('Введите неотрицательное число, до трёх знаков после запятой.');return;}
 const value=Number(raw),previous=records.find(r=>r.addressKey===addressKey()&&r.provider===account.provider&&r.account===account.number&&r.meter===meter&&r.kind===kind);
 if(previous&&value<previous.value){feedback('Значение меньше предыдущего ('+previous.value+' м³). Проверьте ввод. Для нового счётчика укажите его номер; ошибочную запись можно удалить из истории.');return;}
 if(previous&&value===previous.value&&!confirm('Значение совпадает с предыдущим. Сохранить повторное показание?'))return;
 const record={id:crypto.randomUUID(),addressKey:addressKey(),provider:account.provider,account:account.number,meter,kind,value,createdAt:new Date().toISOString(),status:'local'};const next=[record,...records];
 try{localStorage.setItem(key,JSON.stringify(next));}catch(e){feedback('Не удалось сохранить в браузере. Запись не добавлена.');return;}
 records=next;document.getElementById('meterValue').value='';feedback('Показание сохранено в приложении. Поставщику не отправлено.');renderHistory();
 }
 const previousGo=go;go=function(id){if(id==='meters')render();previousGo(id);};
 const previousRenderAll=renderAll;renderAll=function(){previousRenderAll();if(section.classList.contains('active'))render();};
 const previousSaveAccount=saveAccount;saveAccount=function(){previousSaveAccount();render();};
 render();
})();
