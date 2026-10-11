/* Guided local complaints: recommendations, not a determination of liability. */
(function () {
  const services = {
    water: ['Холодная вода', 'Водоканал', /водоканал|холодн.*вод/i],
    hot: ['Горячая вода', 'Нальчикская теплоснабжающая компания', /нтс|тепловые сети|теплоснабжающ|горяч.*вод/i],
    heat: ['Отопление', 'Нальчикская теплоснабжающая компания', /нтс|тепловые сети|теплоснабжающ|отоплен/i],
    power: ['Электроэнергия', 'Электроэнергия', /электро|каббалкэнерго|россети|ставропольэнергосбыт|единый гарантирующий|егп|свет/i],
    gas: ['Газ', 'Газпром межрегионгаз', /газ/i],
    waste: ['Вывоз мусора', 'Экотехпром', /экотехпром|отход|мусор|тко/i],
    housing: ['Содержание дома', 'Управляющая компания', /управляющ|\bук\b|тсж/i],
    other: ['Другая услуга / не знаю', 'Другое', /$a/]
  };
  const topics = {
    quality: 'Нет услуги или плохое качество', bill: 'Неверное начисление',
    payment: 'Не учтён платёж', recalc: 'Нужен перерасчёт',
    meter: 'Проблема со счётчиком', common: 'Проблема в доме или подъезде', other: 'Другая проблема'
  };
  const reasons = {
    recalc: [['readings', 'Не учтены показания счётчика'], ['quality', 'Перебой или плохое качество услуги'], ['absence', 'Временное отсутствие'], ['error', 'Ошибка в расчёте'], ['other', 'Другая причина / не знаю']],
    meter: [['broken', 'Не работает или повреждён'], ['verification', 'Вопрос о поверке'], ['replacement', 'Замена или ввод в эксплуатацию'], ['readings', 'Не принимают показания'], ['other', 'Другая проблема со счётчиком']]
  };
  let state = {}, history = [], formDraft = null;
  const panel = () => document.getElementById('issueStep');
  function add(p, tag, text, cls) { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; p.append(e); return e; }
  function button(p, text, action) { const b = add(p, 'button', text, 'btn secondary block'); b.type = 'button'; b.onclick = action; return b; }
  function screen(title) {
    const p = panel(); p.replaceChildren();
    if (history.length) button(p, '← Назад', () => { const previous = history.pop(); state = previous.state; previous.show(); });
    add(p, 'h3', title);
    document.querySelector('#issueModal .sheet').scrollTop = 0;
    if(formDraft){const names={'Что случилось?':'topicStep','Какой услуги касается проблема?':'serviceStep','Что со счётчиком?':'reasonStep','Почему нужен перерасчёт?':'reasonStep','Где замечена проблема?':'scopeStep','Адресат обращения':'routeStep'};window.IssueDrafts.checkpoint({...formDraft,kind:formDraft.kind||'Выбор проблемы',guide:{...state},questionStep:names[title],questionTrail:history.map(h=>({state:h.state,step:h.show.name}))});}
    return p;
  }
  function next(show, update, current) { history.push({ state: { ...state }, show: current }); state = { ...state, ...update }; show(); }
  function start() { state = {}; history = []; formDraft = {id:crypto.randomUUID(),createdAt:new Date().toISOString(),lifecycle:'draft'}; topicStep(); }
  function topicStep() {
    const p = screen('Что случилось?');
    add(p, 'p', 'Ответьте на несколько вопросов — подскажем адресата и документы.', 'muted');
    add(p, 'p', 'При угрозе жизни, пожаре, запахе газа или другой опасности звоните 112. Обращение в приложении не вызывает аварийную службу.', 'notice');
    Object.entries(topics).forEach(([topic, label]) => button(p, label, () => next(topic === 'common' ? routeStep : serviceStep, { topic, service: topic === 'common' ? 'housing' : undefined }, topicStep)));
  }
  function serviceStep() {
    const p = screen('Какой услуги касается проблема?');
    Object.entries(services).filter(([key]) => state.topic !== 'meter' || !['waste', 'housing'].includes(key)).forEach(([service, [label]]) => button(p, label, () => next(reasons[state.topic] ? reasonStep : state.topic === 'quality' ? scopeStep : routeStep, { service }, serviceStep)));
  }
  function reasonStep() {
    const p = screen(state.topic === 'meter' ? 'Что со счётчиком?' : 'Почему нужен перерасчёт?');
    availableReasons(state).forEach(([reason, label]) => button(p, label, () => next(routeStep, { reason }, reasonStep)));
  }
  function scopeStep() {
    const p = screen('Где замечена проблема?');
    [['home', 'Только в моей квартире / доме'], ['building', 'Во всём доме или у соседей'], ['unknown', 'Не знаю']].forEach(([scope, label]) => button(p, label, () => next(routeStep, { scope }, scopeStep)));
  }
  function availableReasons(g) {
    return (reasons[g.topic]||[]).filter(([reason])=>!(g.topic==='recalc'&&['waste','housing'].includes(g.service)&&reason==='readings')&&!(g.topic==='recalc'&&g.service==='housing'&&reason==='absence'));
  }
  // One destination per service/problem. A saved payee never overrides the service directory.
  function resolveRoute(g, address=savedAddress) {
    const service=services[g.service]||services.other;
    const base={provider:service[1],label:service[1],recipient:undefined,role:'supplier'};
    if(g.topic==='common'||g.service==='housing')return {...base,provider:'Управляющая компания',label:'Управляющая организация дома',recipient:window.Management?.resolve(address)?.org?.name||'',role:'management'};
    if(g.service==='water')return base;
    if(['hot','heat'].includes(g.service))return {...base,label:'НТС',recipient:'ООО «Нальчикские тепловые сети»'};
    if(g.service==='waste')return {...base,label:'Экотехпром',recipient:'МУП «Экотехпром»'};
    if(g.service==='gas') {
      const technical=g.topic==='quality'||(g.topic==='meter'&&['broken','verification','replacement'].includes(g.reason));
      return {...base,label:technical?'Газпром газораспределение Нальчик':'Газпром межрегионгаз Нальчик',recipient:technical?'АО «Газпром газораспределение Нальчик»':'ООО «Газпром межрегионгаз Нальчик»',role:technical?'gas-network':'gas-supply'};
    }
    if(g.service==='power') {
      const technical=g.topic==='meter'&&['broken','verification','replacement'].includes(g.reason);
      if(technical&&!address)return {...base,label:'Организация по обслуживанию электросчётчика',recipient:'',role:'unknown-building'};
      const network=g.topic==='quality'||(technical&&address?.isPrivate);
      return {...base,label:network?'Россети Северный Кавказ — Каббалкэнерго':'Каббалкэнергосбыт (ЕГП)',recipient:network?'ПАО «Россети Северный Кавказ», филиал «Каббалкэнерго»':'ПАО «ЕГП», филиал «Каббалкэнергосбыт»',role:network?'power-network':'power-supply'};
    }
    return {...base,label:'Адресат пока не определён',recipient:'',role:'unknown'};
  }
  function kind(g) {
    if (g.topic === 'quality') return 'Перебой или ненадлежащее качество услуги';
    return ({bill:'Неверное начисление',payment:'Не учтён платёж',recalc:'Нужен перерасчёт',meter:'Проблема со счётчиком',common:'Содержание дома'})[g.topic] || 'Другое';
  }
  function routeStep() {
    const p=screen('Адресат обращения'),route=resolveRoute(state);
    const service=services[state.service]||services.other;
    const explanation=route.recipient===''?'Для этой ситуации нужны дополнительные данные об адресате.':service[0]+': '+route.label+'.';
    add(p,'p',explanation,'notice');
    if(route.role==='management'&&!route.recipient)add(p,'p','Управляющая организация этого дома ещё не сохранена. Укажите её название в форме по квитанции или договору.','muted');
    if(route.role==='unknown-building')add(p,'p','Добавьте адрес и тип жилья: для счётчика в многоквартирном доме нужен гарантирующий поставщик, для частного дома — обслуживающая сетевая организация. Без адреса название нужно уточнить.','muted');
    if(route.role==='unknown')add(p,'p','Для неизвестной услуги нельзя достоверно определить организацию. Опишите вопрос и укажите адресата в форме.','muted');
    if(state.service==='gas')add(p,'p','При запахе газа звоните 104 или 112 из безопасного места. Заявление не вызывает аварийную службу. Расчёты и приём показаний — межрегионгаз; перебои и технические работы — газораспределение.','notice');
    if(state.service==='power')add(p,'p',route.role==='power-network'?'Обращение касается проверки сети или работ со счётчиком в частном доме. Проверьте обслуживающую сеть по договору подключения.':'Начисления, платежи и показания направляются поставщику электричества. По счётчику в многоквартирном доме обращение также готовится гарантирующему поставщику.','muted');
    if(state.service==='waste')add(p,'p','Здесь рассматриваются начисления и вывоз отходов. Ремонт площадки и уборка территории дома — в разделе проблем дома и подъезда. По старым начислениям проверьте организацию в квитанции за спорный период.','muted');
    const seen=new Set();
    const items=route.role==='unknown'?[]:accounts.filter(a=>service[2].test(a.provider)).filter(a=>{if(seen.has(a.number))return false;seen.add(a.number);return true;});
    const prepare=a=>finish(a?.provider||route.provider,route.recipient,explanation,a?.number||'',route.role);
    if(items.length>1){add(p,'p','Выберите лицевой счёт этой услуги.','muted');items.forEach(a=>button(p,'Счёт '+a.number,()=>prepare(a)));}
    else {if(!items.length)add(p,'p','Лицевой счёт можно заполнить позже.','muted');button(p,route.recipient===''?'Продолжить к форме':'Подготовить: '+route.label,()=>prepare(items[0]));}
  }
  function finish(provider, recipient, explanation, account, routeRole) {
    const guide = { ...state, explanation, routeRole };
    const sameRoute=formDraft?.provider===provider && formDraft?.guide?.service===guide.service && formDraft?.guide?.routeRole===guide.routeRole && (account===undefined || (formDraft?.routeAccount??formDraft?.account)===account);
    const data = { ...formDraft, guide, provider, account, routeAccount:account };
    // Reuse typed contact/facts on back/forward, but never carry another service's recipient/account.
    if(sameRoute){data.recipient=formDraft.recipient;data.account=formDraft.account;}
    else if(recipient!==undefined)data.recipient=recipient;
    else delete data.recipient;
    renderIssueForm(provider, kind(guide), data);
  }
  function resume(data) {
    formDraft={...data};state={...data.guide};
    // Reconstruct the question trail, including for a reopened saved complaint.
    history=[{state:{},show:topicStep}];
    if(state.topic!=='common') {
      history.push({state:{topic:state.topic},show:serviceStep});
      if(reasons[state.topic])history.push({state:{topic:state.topic,service:state.service},show:reasonStep});
      else if(state.topic==='quality')history.push({state:{topic:state.topic,service:state.service},show:scopeStep});
    }
    routeStep();
  }
  const bill = ['Квитанция за спорный период', 'Показывает начисление и лицевой счёт.'];
  const meterPhoto = ['Фото счётчика с показаниями и заводским номером', 'Сделайте фото только при безопасном доступе. Текущее фото не подтверждает показания за прошлые периоды.'];
  const readings = ['Подтверждения ранее переданных показаний', 'Скриншоты или квитанции с датами передачи, если сохранились.'];
  const act = ['Акт проверки качества услуги', 'Если уже составлен; при его отсутствии можно попросить провести проверку.'];
  const dispatch = ['Подтверждение обращения в диспетчерскую', 'Номер, дата заявки и ответ, если имеются.'];
  function documents(g = {}, fallbackKind = '') {
    const topic = g.topic || ({'Неверное начисление':'bill','Не учтён платёж':'payment','Нужен перерасчёт':'recalc','Проблема со счётчиком':'meter','Содержание дома':'common','Проблема в подъезде':'common','Нет воды':'quality','Нет горячей воды':'quality','Нет отопления':'quality','Нет электричества':'quality','Слабое давление':'quality'})[fallbackKind];
    if (topic === 'payment') return [bill, ['Чек или подтверждение платежа', 'С датой, суммой, номером операции и реквизитами получателя; посторонние операции не нужны.']];
    if (topic === 'bill') return [bill, ['Предыдущая квитанция или акт сверки', 'Если помогает показать расхождение.'], ...(['waste','housing'].includes(g.service)?[]:[readings])];
    if (topic === 'recalc') {
      if (g.reason === 'readings') return [bill, meterPhoto, readings];
      if (g.reason === 'quality'&&g.service==='waste')return [bill,['Фото переполненных контейнеров и сведения о невывозе','Укажите адрес площадки и даты нарушения.'],['Предыдущие заявки и ответы оператора','Если имеются.']];
      if (g.reason === 'quality') return [bill, act, dispatch, ['Фото или видео последствий перебоя', 'Если наглядно подтверждает обстоятельства и безопасно снять.']];
      if (g.reason === 'absence') return [bill, ['Документы о периоде отсутствия', 'Например, именные билеты с подтверждением поездки или справка о временном проживании. Выберите подходящее подтверждение.'], ...(g.service === 'waste' ? [] : [['Акт об отсутствии технической возможности установки счётчика', 'Только если это условие применимо к вашей услуге и ситуации.']])];
      return [bill, ['Документы, подтверждающие основание перерасчёта', 'Например, акт сверки или подтверждение ошибки в исходных данных.']];
    }
    if (topic === 'meter') {
      if (g.reason === 'verification') return [['Сведения о поверке из ФГИС «Аршин»', 'Номер записи или выписка, если поверка уже проведена.'], ['Паспорт прибора учёта', 'Если сохранился.'], ['Предыдущий акт ввода в эксплуатацию', 'Если имеется.']];
      if (g.reason === 'replacement') return [['Акт ввода счётчика в эксплуатацию', 'Если ввод уже выполнен.'], ['Зафиксированные показания старого и нового счётчиков', 'Акт замены или фотографии, если имеются.'], ['Паспорт нового прибора учёта', 'Если имеется.']];
      if (g.reason === 'readings') return [meterPhoto, readings, ['Ответ об отказе принять показания', 'Скриншот ошибки или ответ организации, если имеется.']];
      return [meterPhoto, ['Фото видимого дефекта счётчика', 'Не вскрывайте прибор и не снимайте пломбы ради фотографии.'], ['Паспорт и имеющиеся акты по прибору', 'Поверка, ввод в эксплуатацию или предыдущий осмотр — если имеются.']];
    }
    if (topic === 'quality'&&g.service==='waste')return [['Фото переполненных контейнеров', 'Укажите адрес площадки и даты, когда отходы не вывозили.'], ['Предыдущие заявки о невывозе и ответы', 'Если имеются.']];
    if (topic === 'quality') return [act, dispatch, ['Фото или видео проблемы', 'С указанием места и времени; снимайте только если это безопасно.']];
    if (topic === 'common') return [['Фото дефекта и общего вида места', 'Укажите подъезд, этаж или участок дома; избегайте лишних персональных данных соседей.'], ['Имеющиеся акты осмотра и предыдущие обращения', 'Если проблема уже фиксировалась.']];
    return [['Документы или фотографии по существу проблемы', 'Только относящиеся к обращению; при отсутствии можно описать обстоятельства.']];
  }
  function renderDocuments(parent, guide, problem, target) {
    const box = add(parent, 'section', '', 'issue-evidence');
    add(box, 'h3', 'Что подготовить к обращению');
    add(box, 'p', 'Это подсказки, а не обязательный для всех список. Отметьте только то, что подготовили и передадите вместе с обращением. Отсутствие документов не блокирует создание заявления.', 'muted');
    if (guide?.reason === 'absence') add(box, 'p', 'Условия перерасчёта за отсутствие зависят от услуги, учёта потребления и обстоятельств. Для вывоза мусора действуют отдельные правила. Само отсутствие не гарантирует перерасчёт.', 'notice');
    documents(guide, problem).forEach(([name, hint]) => {
      const label = add(box, 'label', ''); label.style.cssText = 'display:block;margin:16px 0;overflow-wrap:anywhere';
      const check = document.createElement('input'); check.type = 'checkbox'; check.style.cssText = 'width:20px;height:20px;margin-right:8px;vertical-align:middle'; label.append(check, document.createTextNode(name));
      add(label, 'span', hint, 'muted').style.display = 'block';
      check.checked = target.value.split('\n').includes(name);
      check.onchange = () => {
        const lines = target.value.split('\n');
        if (check.checked && !lines.includes(name)) target.value = [...lines.filter(Boolean), name].join('\n');
        if (!check.checked) target.value = lines.filter(line => line !== name).join('\n');
        target.dispatchEvent(new Event('input',{bubbles:true}));
      };
      target.addEventListener('input', () => { check.checked = target.value.split('\n').includes(name); });
    });
  }
  function context(g) {
    if (!g) return '';
    const reason = reasons[g.topic]?.find(([key]) => key === g.reason)?.[1];
    return ['Услуга: ' + (services[g.service]?.[0] || 'уточняется'), reason ? 'Основание обращения: ' + reason : '', g.scope ? 'По наблюдениям заявителя: ' + ({home:'проблема замечена только в своём помещении',building:'проблема также замечена у соседей или в доме',unknown:'масштаб проблемы неизвестен'})[g.scope] + '.' : '', g.topic === 'quality' ? 'Сообщаю о перебое или ненадлежащем качестве указанной услуги. Прошу установить причину, проверить границы ответственности и сообщить порядок устранения проблемы.' : ''].filter(Boolean).join('\n');
  }
  function restore(data){const steps={topicStep,serviceStep,reasonStep,scopeStep,routeStep};formDraft={...data};state={...data.guide};history=(data.questionTrail||[]).filter(h=>steps[h.step]).map(h=>({state:h.state,show:steps[h.step]}));(steps[data.questionStep]||topicStep)();}
  window.IssueGuide = { start, resume, restore, resolveRoute, availableReasons, documents, renderDocuments, context };
  renderIssueProviderStep = start;
})();
