/* Meter passports and local due-date reminders. No provider transmission. */
(function () {
  const KEY = 'mydomMetersV1';
  const kinds = ['Холодная вода', 'Горячая вода', 'Электроэнергия', 'Газ', 'Тепло', 'Другое'];
  let meters = [], failed = false;
  try { meters = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(meters) || meters.some(m => !m || !m.id || !m.serial)) throw Error(); }
  catch (_) { failed = true; meters = []; }
  const el = id => document.getElementById(id);
  function add(p, tag, text = '', cls) { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; p.append(e); return e; }
  function button(p, text, action, secondary = true) { const b = add(p, 'button', text, 'btn ' + (secondary ? 'secondary ' : '') + 'block'); b.type = 'button'; b.onclick = action; return b; }
  function field(p, name, label, value = '', type = 'text', required = false) {
    const l = add(p, 'label', label + (required ? ' *' : ''), 'formlabel'); l.htmlFor = 'passport-' + name;
    const e = add(p, 'input', '', 'input'); e.id = l.htmlFor; e.type = type; e.value = value || ''; e.required = required; e.maxLength = 300; return e;
  }
  function select(p, name, label, options, value) {
    const l = add(p, 'label', label, 'formlabel'); l.htmlFor = 'passport-' + name;
    const e = add(p, 'select', '', 'input'); e.id = l.htmlFor;
    options.forEach(([v, text]) => { const o = add(e, 'option', text); o.value = v; }); e.value = value; return e;
  }
  const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
  function day(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN; const d = new Date(value + 'T00:00:00Z'); return Number.isFinite(+d) && d.toISOString().slice(0,10) === value ? +d / 86400000 : NaN; }
  function due(date, now = today()) { const days = day(date) - day(now); return !Number.isFinite(days) ? { level: 'unknown', text: 'Дата не указана' } : days < 0 ? {level:'overdue', days, text:'Срок прошёл · ' + (-days) + ' дн. назад'} : days === 0 ? {level:'today', days, text:'Срок сегодня'} : {level:days<=7?'week':days<=30?'month':days<=60?'soon':'future', days, text:'До срока: ' + days + ' дн.'}; }
  const formatDate = date => Number.isFinite(day(date)) ? date.split('-').reverse().join('.') : 'не указана';
  const addressKey = () => savedAddress ? JSON.stringify([savedAddress.street, savedAddress.house, savedAddress.apartment]) : '';
  const identity = m => [m.kind,m.provider,m.account,m.serial].map(v=>String(v||'').trim().toLowerCase()).join('|');
  function history() { try { const rows=JSON.parse(localStorage.getItem('mydomMeterHistory')||'[]'); return Array.isArray(rows)?rows:[]; } catch (_) { return []; } }
  function matches(row, m) {
    if (row.addressKey !== addressKey()) return false;
    if (row.meterId) return row.meterId === m.id;
    const same = x => row.provider===x.provider && row.account===x.account && row.meter===x.serial && row.kind===x.kind;
    return same(m) || (m.readingIdentity && same(m.readingIdentity));
  }
  const previous = id => { const m=meters.find(m=>m.id===id); return m ? history().find(r=>matches(r,m)) : undefined; };
  function events(m) { return m.status === 'archived' ? [] : [m.nextVerification ? {type:'verification',title:'Поверка',date:m.nextVerification} : null, m.actionDate && m.actionTitle ? {type:'action',title:m.actionTitle,date:m.actionDate} : null].filter(Boolean); }
  function commit(next) { try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) { alert('Не удалось сохранить счётчик. Данные на экране не потеряны; освободите место и повторите.'); return false; } meters=next; return true; }
  let modal;
  function close() { modal.classList.remove('show'); }
  function edit(existing = {}) {
    if (failed || !savedAddress) return;
    if (!modal) { modal=add(document.body,'div','','modal center'); modal.id='meterPassportModal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','meterPassportTitle'); modal.addEventListener('keydown',e=>{if(e.key==='Escape')close();}); }
    modal.replaceChildren(); const sheet=add(modal,'div','','sheet'); add(sheet,'h3',existing.id?'Карточка счётчика':'Добавить счётчик').id='meterPassportTitle';
    add(sheet,'p','Данные относятся к выбранной квартире. Даты перепишите из документов на прибор или сведений о поверке.','muted');
    if(existing.id)add(sheet,'p','При замене создайте новую карточку, а прежнюю переведите в архив. Изменение номера здесь исправляет данные того же прибора.','muted');
    const f=add(sheet,'form');
    select(f,'kind','Услуга',kinds.map(v=>[v,v]),existing.kind||kinds[0]);
    field(f,'serial','Заводской номер',existing.serial,'text',true);
    field(f,'model','Модель (необязательно)',existing.model);
    field(f,'location','Где установлен: кухня, ванная и т. п.',existing.location);
    const choice=select(f,'accountChoice','Взять поставщика и счёт из сохранённых',[['','Указать вручную / счёта пока нет'],...accounts.map((a,i)=>[String(i),a.provider+' · '+a.number])],'');
    const provider=field(f,'provider','Поставщик / обслуживающая организация',existing.provider);
    const account=field(f,'account','Лицевой счёт (если известен)',existing.account);
    choice.onchange=()=>{if(choice.value!==''){const a=accounts[Number(choice.value)];provider.value=a.provider;account.value=a.number;}};
    field(f,'installed','Дата установки',existing.installed,'date');
    field(f,'commissioned','Дата ввода в эксплуатацию',existing.commissioned,'date');
    field(f,'verification','Дата последней поверки',existing.verification,'date');
    field(f,'nextVerification','Следующая поверка — указанная в документах дата',existing.nextVerification,'date');
    add(f,'p','Если срок неизвестен, оставьте поле пустым. Приложение предложит уточнить его. Универсальный интервал поверки не подставляется.','muted');
    select(f,'seal','Состояние пломбы',[['unknown','Не знаю'],['intact','Целая'],['damaged','Повреждена / отсутствует']],existing.seal||'unknown');
    select(f,'status','Состояние счётчика',[['active','Используется'],['fault','Есть неисправность'],['archived','Снят / заменён (архив)']],existing.status||'active');
    add(f,'h3','Другое важное действие');
    field(f,'actionTitle','Что нужно сделать (необязательно)',existing.actionTitle);
    field(f,'actionDate','Дата действия',existing.actionDate,'date');
    add(f,'p','Например: согласованный осмотр или ввод после замены. Срок укажите по документам или договорённости с организацией.','muted');
    field(f,'notes','Примечание',existing.notes);
    add(f,'p','Предупреждения появляются на главной и в разделе счётчиков за 60, 30 и 7 дней, а также в день срока и после него. Чтобы напоминание работало вне приложения, после сохранения добавьте событие в календарь телефона.','notice');
    const error=add(f,'p','','notice');error.id='passportError';error.hidden=true;error.setAttribute('role','alert');
    const save=add(f,'button','Сохранить счётчик','btn block');save.type='submit';
    button(sheet,'Отмена',close);
    f.onsubmit=e=>{
      e.preventDefault(); const value=n=>el('passport-'+n).value.trim(); const data={...existing,id:existing.id||crypto.randomUUID()};
      ['kind','serial','model','location','provider','account','installed','commissioned','verification','nextVerification','seal','status','actionTitle','actionDate','notes'].forEach(n=>data[n]=value(n));
      const fail=message=>{error.hidden=false;error.textContent=message;error.scrollIntoView({block:'nearest'});};
      if(!data.serial)return fail('Укажите заводской номер счётчика.');
      if(meters.some(m=>m.id!==data.id&&identity(m)===identity(data)))return fail('Такой счётчик уже сохранён. Откройте его карточку.');
      if(['installed','commissioned','verification','nextVerification','actionDate'].some(k=>data[k]&&!Number.isFinite(day(data[k]))))return fail('Проверьте даты.');
      if(data.verification&&data.verification>today())return fail('Дата уже выполненной поверки не может быть в будущем.');
      if(data.verification&&data.nextVerification&&data.nextVerification<=data.verification)return fail('Следующая поверка должна быть позже последней.');
      if(data.installed&&data.commissioned&&data.commissioned<data.installed)return fail('Ввод в эксплуатацию не может быть раньше установки.');
      if(Boolean(data.actionTitle)!==Boolean(data.actionDate))return fail('Для другого действия укажите и название, и дату.');
      data.readingIdentity=existing.readingIdentity||{kind:data.kind,provider:data.provider,account:data.account,serial:data.serial};
      data.updatedAt=new Date().toISOString();data.createdAt=existing.createdAt||data.updatedAt;
      if(commit([data,...meters.filter(m=>m.id!==data.id)])){close();render();}
    };
    modal.classList.add('show');sheet.scrollTop=0;el('passport-serial').focus();
  }
  const escapeCalendar = text => String(text||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  function calendar(m,event) {
    // Fold by UTF-8 bytes, not JS code units (RFC 5545).
    const fold=line=>{const lines=[];let part='',size=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>75){lines.push(part);part=' ';size=1;}part+=c;size+=n;}lines.push(part);return lines.join('\r\n');};
    const tomorrow=new Date((day(event.date)+1)*86400000).toISOString().slice(0,10).replaceAll('-','');
    const desc='Счётчик '+m.serial+(m.model?' · '+m.model:'')+'\n'+(savedAddress?savedAddress.street+', '+savedAddress.house+(savedAddress.isPrivate?'':', кв. '+savedAddress.apartment):'')+'\nУточните порядок действий у обслуживающей организации. После выполнения обновите даты в «Мой дом». Повторный импорт проверьте в календаре, чтобы избежать дубликатов.';
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MyDom//Meter reminders//RU','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+m.id+'-'+event.type+'@mydom.local','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;VALUE=DATE:'+event.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+tomorrow,'SUMMARY:'+escapeCalendar(event.title+': '+m.kind),'DESCRIPTION:'+escapeCalendar(desc),...[60,30,7].flatMap(days=>['BEGIN:VALARM','TRIGGER:-P'+days+'D','ACTION:DISPLAY','DESCRIPTION:'+escapeCalendar(event.title+': '+m.kind),'END:VALARM']),'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
  }
  function download(m,event) {const a=document.createElement('a'),url=URL.createObjectURL(new Blob([calendar(m,event)],{type:'text/calendar;charset=utf-8'}));a.href=url;a.download='mydom-meter-'+event.type+'.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function drawCards(box) {
    add(box,'h2','Мои счётчики');
    add(box,'p','Карточки и история сохраняются в этом браузере. Сохранение показания не отправляет его поставщику.','muted');
    if(failed){add(box,'p','Не удалось прочитать карточки счётчиков. Сохранённые данные не изменены. Восстановите резервную копию в разделе «Ещё».','notice');return;}
    if(!savedAddress){add(box,'p','Сначала выберите квартиру на главной.','notice');return;}
    button(box,'+ Добавить счётчик',()=>edit(),false);
    if(!meters.length)add(box,'p','Добавьте приборы этой квартиры, чтобы не вводить их данные заново и видеть важные сроки.','muted');
    meters.forEach(m=>{
      const c=add(box,'article','','card');c.style.marginTop='16px';
      add(c,'h3',m.kind+' · '+m.serial);add(c,'p',[m.model,m.location].filter(Boolean).join(' · '),'muted');
      add(c,'p',[m.provider,m.account?'Л/с '+m.account:'Лицевой счёт не указан'].filter(Boolean).join(' · '),'muted');
      add(c,'p',m.status==='archived'?'В архиве · напоминания отключены':m.status==='fault'?'Указана неисправность · уточните дальнейшие действия у обслуживающей организации':'Используется',m.status==='fault'?'notice':'muted');
      if(m.seal==='damaged')add(c,'p','Указано повреждение или отсутствие пломбы. Свяжитесь с обслуживающей организацией.','notice');
      add(c,'p','Установка: '+formatDate(m.installed)+' · Ввод: '+formatDate(m.commissioned),'muted');
      add(c,'p','Последняя поверка: '+formatDate(m.verification),'muted');
      add(c,'p','Следующая поверка: '+formatDate(m.nextVerification),'muted');
      if(!m.nextVerification&&m.status!=='archived')add(c,'p','Уточните срок поверки: без даты заранее напомнить о ней невозможно.','notice');
      events(m).forEach(event=>{const status=due(event.date);add(c,'p',event.title+' · '+formatDate(event.date)+' · '+status.text,status.level==='future'?'muted':'notice');if(status.days>=0)button(c,event.type==='verification'?'Напомнить о поверке в календаре':'Добавить действие в календарь',()=>download(m,event));});
      const rows=history().filter(r=>matches(r,m));
      if(rows.length){add(c,'p','Последнее сохранённое показание: '+rows[0].value+' м³ · '+new Date(rows[0].createdAt).toLocaleDateString('ru-RU'),'muted');if(rows.length>1&&rows[0].value>=rows[1].value)add(c,'p','Разница с предыдущим: '+Number((rows[0].value-rows[1].value).toFixed(3))+' м³','muted');}
      if(m.notes)add(c,'p',m.notes,'muted');
      button(c,'Изменить данные / отметить поверку',()=>edit(m));
      if(m.status!=='archived'&&['Холодная вода','Горячая вода'].includes(m.kind))button(c,'Внести показание',()=>{const s=el('registeredMeter');if(s&&[...s.options].some(o=>o.value===m.id)){s.value=m.id;s.dispatchEvent(new Event('change'));el('meterValue').focus();el('meterValue').scrollIntoView({block:'center'});}else alert('Для показаний добавьте соответствующий лицевой счёт водоканала или теплоснабжающей организации.');});
    });
    const seen=new Set();history().filter(r=>r.addressKey===addressKey()&&!meters.some(m=>matches(r,m))).forEach(r=>{const m={kind:r.kind,provider:r.provider,account:r.account,serial:r.meter};const id=identity(m);if(seen.has(id))return;seen.add(id);button(box,'Создать карточку из истории: '+r.kind+' · '+r.meter,()=>edit(m));});
    add(box,'p','Календарь: скачайте и импортируйте событие, затем проверьте оповещения в своём календаре. Поддержка напоминаний зависит от приложения и его настроек. Изменения срока здесь не обновляют уже импортированное событие — его нужно изменить отдельно.','muted');
  }
  function wireReadings() {
    if(!el('meterAccount'))return;
    const selected=el('registeredMeter')?.value||'';
    if(el('registeredMeter')){el('registeredMeter').previousElementSibling.remove();el('registeredMeter').remove();}
    const label=document.createElement('label');label.className='formlabel';label.htmlFor='registeredMeter';label.textContent='Сохранённый счётчик';
    const s=document.createElement('select');s.className='input';s.id='registeredMeter';
    const available=meters.filter(m=>m.status!=='archived'&&['Холодная вода','Горячая вода'].includes(m.kind)&&['Водоканал','Нальчикская теплоснабжающая компания'].includes(m.provider)&&accounts.some(a=>a.provider===m.provider&&a.number===m.account));
    [['','Ввести данные вручную'],...available.map(m=>[m.id,m.kind+' · '+m.serial+(m.location?' · '+m.location:'')])].forEach(([v,t])=>{const o=add(s,'option',t);o.value=v;});
    const anchor=el('meterAccount').previousElementSibling;anchor.before(label,s);
    if(available.some(m=>m.id===selected))s.value=selected;
    s.onchange=()=>{const m=meters.find(m=>m.id===s.value);if(!m)return;const options=[...el('meterAccount').options];const acc=accounts.filter(a=>['Водоканал','Нальчикская теплоснабжающая компания'].includes(a.provider));const index=acc.findIndex(a=>a.provider===m.provider&&a.number===m.account);if(index<0||!options[index])return;s.value=m.id;el('meterAccount').value=String(index);el('meterKind').value=m.kind;el('meterNumber').value=m.serial;el('meterValue').value='';const prev=previous(m.id);const f=el('meterFeedback');f.className='notice';f.textContent=prev?'Предыдущее сохранённое показание: '+prev.value+' м³':'Для этого счётчика показаний пока нет.';};
    ['meterAccount','meterKind','meterNumber'].forEach(id=>el(id).oninput=()=>{s.value='';});
  }
  function renderHome() {
    let box=el('meterReminders');if(!box){box=add(el('home'),'div','','card');box.id='meterReminders';document.querySelector('#home .address').after(box);}box.replaceChildren();
    const list=meters.flatMap(m=>events(m).map(event=>({m,event,status:due(event.date)}))).filter(x=>x.status.days<=60).sort((a,b)=>a.status.days-b.status.days);
    const unknown=meters.filter(m=>m.status!=='archived'&&!m.nextVerification);
    const fault=meters.filter(m=>m.status!=='archived'&&(m.status==='fault'||m.seal==='damaged'));
    box.hidden=!failed&&!list.length&&!unknown.length&&!fault.length;
    if(box.hidden){window.HomeDesign?.renderAttention();return;}
    add(box,'h3','Важно по счётчикам');
    if(failed)add(box,'p','Не удалось прочитать карточки счётчиков. Проверьте данные в разделе «Показания».','notice');
    list.forEach(({m,event,status})=>add(box,'p',event.title+' · '+m.kind+' № '+m.serial+' · '+formatDate(event.date)+' — '+status.text,'notice'));
    if(unknown.length)add(box,'p','Уточните срок поверки: '+unknown.map(m=>m.kind+' № '+m.serial).join(', '),'muted');
    if(fault.length)add(box,'p','Есть отметка о неисправности или повреждении пломбы: '+fault.map(m=>m.kind+' № '+m.serial).join(', '),'notice');
    add(box,'p','Для выбранной квартиры. Проверьте сроки по документам; после выполненных работ обновите карточку.','muted');button(box,'Открыть счётчики',()=>go('meters'));window.HomeDesign?.renderAttention();
  }
  function render() {let box=el('meterPassports');if(!box){box=document.createElement('div');box.id='meterPassports';const section=el('meters');section.querySelector('.local-note').after(box);}box.replaceChildren();drawCards(box);wireReadings();renderHome();}
  window.MeterRegistry={alerts:()=>{const rows=[];for(const m of meters){if(m.status==='archived')continue;for(const e of events(m)){const d=due(e.date);if(d.days<=60)rows.push({title:e.title+' · '+d.text,detail:m.kind+' № '+m.serial+' · '+formatDate(e.date),days:d.days});}if(!m.nextVerification)rows.push({title:'Уточните срок поверки',detail:m.kind+' № '+m.serial,days:999});if(m.status==='fault'||m.seal==='damaged')rows.push({title:'Проверьте состояние счётчика',detail:m.kind+' № '+m.serial,days:-Infinity});}if(failed)rows.push({title:'Не удалось прочитать счётчики',detail:'Проверьте сохранённые данные',days:-Infinity});return rows.sort((a,b)=>a.days-b.days);},render,renderHome,previous,due,calendar,today,edit,get:id=>meters.find(m=>m.id===id)};
  const oldGo=go;go=function(id){oldGo(id);if(id==='home')renderHome();};
  const oldRenderAll=renderAll;renderAll=function(){oldRenderAll();renderHome();};
  let renderedDay=today();
  function refreshReminders(){if(renderedDay!==today()){renderedDay=today();render();}else renderHome();}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshReminders();});
  window.addEventListener('focus',refreshReminders);
  window.addEventListener('storage',e=>{if(e.key===KEY)location.reload();});
  setInterval(refreshReminders,60000);
  render();
})();
