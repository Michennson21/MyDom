/* Guided local complaints: recommendations, not a determination of liability. */
(function () {
  const services = {
    water: ['Холодная вода', 'Водоканал', /водоканал|холодн.*вод/i],
    hot: ['Горячая вода', 'Нальчикская теплоснабжающая компания', /тепло|горяч.*вод/i],
    heat: ['Отопление', 'Нальчикская теплоснабжающая компания', /тепло|отоплен/i],
    power: ['Электроэнергия', 'Электроэнергия', /электро|энерго|свет/i],
    gas: ['Газ', 'Газпром межрегионгаз', /газ/i],
    waste: ['Вывоз мусора', 'Вывоз мусора', /экотехпром|отход|мусор|тко/i],
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
  let state = {}, history = [];
  const panel = () => document.getElementById('issueStep');
  function add(p, tag, text, cls) { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; p.append(e); return e; }
  function button(p, text, action) { const b = add(p, 'button', text, 'btn secondary block'); b.type = 'button'; b.onclick = action; return b; }
  function screen(title) {
    const p = panel(); p.replaceChildren();
    if (history.length) button(p, '← Назад', () => { const previous = history.pop(); state = previous.state; previous.show(); });
    add(p, 'h3', title);
    document.querySelector('#issueModal .sheet').scrollTop = 0;
    return p;
  }
  function next(show, update, current) { history.push({ state: { ...state }, show: current }); state = { ...state, ...update }; show(); }
  function start() { state = {}; history = []; topicStep(); }
  function topicStep() {
    const p = screen('Что случилось?');
    add(p, 'p', 'Ответьте на несколько вопросов — подскажем адресата и документы.', 'muted');
    add(p, 'p', 'При угрозе жизни, пожаре, запахе газа или другой опасности звоните 112. Обращение в приложении не вызывает аварийную службу.', 'notice');
    Object.entries(topics).forEach(([topic, label]) => button(p, label, () => next(topic === 'common' ? routeStep : serviceStep, { topic, service: topic === 'common' ? 'housing' : undefined }, topicStep)));
  }
  function serviceStep() {
    const p = screen('Какой услуги касается проблема?');
    Object.entries(services).filter(([key]) => state.topic !== 'meter' || !['waste', 'housing'].includes(key)).forEach(([service, [label]]) => button(p, label, () => next(reasons[state.topic] ? reasonStep : state.topic === 'quality' ? scopeStep : payerStep, { service }, serviceStep)));
  }
  function reasonStep() {
    const p = screen(state.topic === 'meter' ? 'Что со счётчиком?' : 'Почему нужен перерасчёт?');
    reasons[state.topic].forEach(([reason, label]) => button(p, label, () => next(state.topic === 'meter' ? routeStep : payerStep, { reason }, reasonStep)));
  }
  function scopeStep() {
    const p = screen('Где замечена проблема?');
    [['home', 'Только в моей квартире / доме'], ['building', 'Во всём доме или у соседей'], ['unknown', 'Не знаю']].forEach(([scope, label]) => button(p, label, () => next(routeStep, { scope }, scopeStep)));
  }
  function payerStep() {
    if (state.topic === 'other') { routeStep(); return; }
    const p = screen('Как услуга указана в квитанции?');
    add(p, 'p', 'Это поможет определить, у кого запросить проверку расчёта.', 'muted');
    [['supplier', 'Отдельный поставщик услуги'], ['management', 'Управляющая компания / ТСЖ'], ['unknown', 'Не знаю / нет квитанции']].forEach(([payer, label]) => button(p, label, () => next(routeStep, { payer }, payerStep)));
  }
  function kind(g) {
    if (g.topic === 'quality') return 'Перебой или ненадлежащее качество услуги';
    return ({bill:'Неверное начисление',payment:'Не учтён платёж',recalc:'Нужен перерасчёт',meter:'Проблема со счётчиком',common:'Содержание дома'})[g.topic] || 'Другое';
  }
  function routeStep() {
    const p = screen('Кому подготовить обращение');
    const management = state.topic === 'common' || state.service === 'housing' || state.payer === 'management' || (state.topic === 'quality' && !savedAddress?.isPrivate && state.service !== 'gas' && state.service !== 'waste');
    const service = services[state.service] || services.other;
    const uncertain = state.payer === 'unknown' || state.service === 'other';
    const providers = [...new Set([...accounts, ...manualBills].map(a => a.provider).filter(Boolean))];
    const candidates = management ? ['Управляющая компания'] : uncertain ? providers : providers.filter(name => service[2].test(name));
    const explanation = management
      ? state.topic === 'quality' ? 'Начать предлагаем с управляющей организации: попросим проверить причину и границы ответственности. По масштабу перебоя нельзя однозначно установить виновную организацию.' : 'По вашим ответам обращение относится к управляющей организации дома.'
      : uncertain ? 'Данных для однозначного выбора пока недостаточно. Уточните адресата по квитанции или договору.' : 'По выбранной услуге предлагаем исполнителя из сохранённых счетов. Проверьте название по квитанции или договору.';
    add(p, 'p', explanation, 'muted');
    if (state.service === 'gas') add(p, 'p', 'При запахе газа звоните 104 или 112 из безопасного места. Подготовка заявления не заменяет аварийный вызов.', 'notice');
    if (state.topic === 'meter' && state.service === 'power') add(p, 'p', 'Ответственная за электросчётчик организация может отличаться от получателя платежа. Уточните её в договоре или у поставщика электроэнергии.', 'notice');
    if (!candidates.length) {
      add(p, 'p', 'Подтверждённого названия организации нет. Введите его на следующем шаге.', 'notice');
      button(p, 'Продолжить и указать адресата', () => finish(service[1], '', explanation));
    }
    candidates.forEach(provider => {
      const items = accounts.filter(a => a.provider === provider);
      const name = provider === 'Управляющая компания' ? window.Management?.resolve(savedAddress)?.org?.name || '' : provider;
      if (items.length > 1) {
        add(p, 'p', provider + ': несколько лицевых счетов — выберите нужный.', 'muted');
        items.forEach(a => button(p, provider + ' · счёт ' + a.number, () => finish(provider, undefined, explanation, a.number)));
      } else button(p, name ? 'Подготовить: ' + name : 'Указать управляющую организацию', () => finish(provider, name || '', explanation, items[0]?.number));
    });
    if (candidates.length) button(p, 'Указать другую организацию', () => finish(service[1], '', 'Адресат указан пользователем; проверьте его по договору.', ''));
  }
  function finish(provider, recipient, explanation, account) {
    const guide = { ...state, explanation };
    const data = { guide, account };
    // Leave resolution to existing QR/management logic when an actual supplier was found.
    if (recipient === '') data.recipient = '';
    renderIssueForm(provider, kind(guide), data);
  }
  const bill = ['Квитанция за спорный период', 'Показывает начисление и лицевой счёт.'];
  const meterPhoto = ['Фото счётчика с показаниями и заводским номером', 'Сделайте фото только при безопасном доступе. Текущее фото не подтверждает показания за прошлые периоды.'];
  const readings = ['Подтверждения ранее переданных показаний', 'Скриншоты или квитанции с датами передачи, если сохранились.'];
  const act = ['Акт проверки качества услуги', 'Если уже составлен; при его отсутствии можно попросить провести проверку.'];
  const dispatch = ['Подтверждение обращения в диспетчерскую', 'Номер, дата заявки и ответ, если имеются.'];
  function documents(g = {}, fallbackKind = '') {
    const topic = g.topic || ({'Неверное начисление':'bill','Не учтён платёж':'payment','Нужен перерасчёт':'recalc','Проблема со счётчиком':'meter','Содержание дома':'common','Проблема в подъезде':'common','Нет воды':'quality','Нет горячей воды':'quality','Нет отопления':'quality','Нет электричества':'quality','Слабое давление':'quality'})[fallbackKind];
    if (topic === 'payment') return [bill, ['Чек или подтверждение платежа', 'С датой, суммой, номером операции и реквизитами получателя; посторонние операции не нужны.']];
    if (topic === 'bill') return [bill, ['Предыдущая квитанция или акт сверки', 'Если помогает показать расхождение.'], readings];
    if (topic === 'recalc') {
      if (g.reason === 'readings') return [bill, meterPhoto, readings];
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
      };
      target.addEventListener('input', () => { check.checked = target.value.split('\n').includes(name); });
    });
  }
  function context(g) {
    if (!g) return '';
    const reason = reasons[g.topic]?.find(([key]) => key === g.reason)?.[1];
    return ['Услуга: ' + (services[g.service]?.[0] || 'уточняется'), reason ? 'Основание обращения: ' + reason : '', g.scope ? 'По наблюдениям заявителя: ' + ({home:'проблема замечена только в своём помещении',building:'проблема также замечена у соседей или в доме',unknown:'масштаб проблемы неизвестен'})[g.scope] + '.' : '', g.topic === 'quality' ? 'Сообщаю о перебое или ненадлежащем качестве указанной услуги. Прошу установить причину, проверить границы ответственности и сообщить порядок устранения проблемы.' : ''].filter(Boolean).join('\n');
  }
  window.IssueGuide = { start, documents, renderDocuments, context };
  renderIssueProviderStep = start;
})();
