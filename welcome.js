/* Guided first launch reuses existing address/account forms and never clears data. */
let welcomeStep=0;
const welcome=document.createElement('div');
welcome.style.zIndex='9';welcome.id='welcomeFlow';welcome.className='modal center';welcome.setAttribute('role','dialog');welcome.setAttribute('aria-modal','true');welcome.setAttribute('aria-labelledby','welcomeTitle');
welcome.innerHTML='<div class="sheet" style="max-width:600px"><div id="welcomeContent"></div></div>';document.body.append(welcome);
function startWelcome(){welcomeStep=0;welcome.classList.add('show');document.querySelector('.app').inert=true;renderWelcome();}
function renderWelcome(){
 const steps=['Знакомство','Ваш адрес','Лицевой счёт','Готово'];
 let body='';
 if(welcomeStep===0)body='<h2 id="welcomeTitle">Добро пожаловать в «Мой дом»</h2><p>Настроим вашу квартиру за несколько шагов.</p><div class="mini">1. Выберите дом и квартиру<br>2. Добавьте лицевой счёт<br>3. Ведите начисления и показания</div><p class="muted">Без входа данные хранятся в этом браузере. Серверную копию можно сохранить в разделе «Ещё», если сервер подключён. Платежи и отправка данных поставщикам ещё не подключены. Регистрация сейчас не требуется.</p>';
 if(welcomeStep===1)body='<h2 id="welcomeTitle">Где находится ваша квартира?</h2><p>Выберите адрес в Нальчике. По нему приложение проверит сведения об управляющей организации.</p><div class="mini">'+(savedAddress?escapeHtml(savedAddress.street+', '+savedAddress.house+', кв. '+savedAddress.apartment):'Адрес пока не выбран')+'</div><button class="btn secondary block" onclick="openAddress()">'+(savedAddress?'Изменить адрес':'Выбрать адрес')+'</button>';
 if(welcomeStep===2)body='<h2 id="welcomeTitle">Добавьте лицевой счёт</h2><p>Его номер указан в квитанции. Можно начать с одной услуги, а остальные добавить позже.</p><div class="mini">'+(accounts.length?'Добавлено счетов: '+accounts.length:'Лицевых счетов пока нет')+'</div><button class="btn secondary block" onclick="openAccount()">Добавить лицевой счёт</button><p class="muted">Этот шаг можно пропустить. При сохранении QR-квитанции лицевой счёт также добавится автоматически.</p>';
 if(welcomeStep===3)body='<h2 id="welcomeTitle">Можно начинать</h2><p>На главной — ваша квартира и быстрые действия. В разделе «Начисления» можно добавить квитанцию вручную или через QR.</p><div class="notice">Записи и отметки об оплате вводите вы. Подтверждённые данные поставщиков появятся после подключения.</div>';
 document.getElementById('welcomeContent').innerHTML='<div class="eyebrow">ШАГ '+(welcomeStep+1)+' ИЗ 4 · '+steps[welcomeStep]+'</div>'+body+'<div id="welcomeError" role="alert"></div><div class="actions">'+(welcomeStep?'<button class="btn secondary" onclick="welcomeStep--;renderWelcome()">Назад</button>':'')+'<button class="btn" onclick="nextWelcome()">'+(welcomeStep===3?'Открыть главную':welcomeStep===0?'Начать':welcomeStep===2&&!accounts.length?'Добавить позже':'Продолжить')+'</button></div><button class="back" style="margin-top:20px" onclick="closeWelcome(false)">Закрыть знакомство</button>';
 document.getElementById('welcomeTitle').setAttribute('tabindex','-1');document.getElementById('welcomeTitle').focus();
}
function nextWelcome(){if(welcomeStep===1&&!savedAddress){document.getElementById('welcomeError').textContent='Сначала выберите адрес или закройте знакомство, чтобы сделать это позже.';return;}if(welcomeStep===3){closeWelcome(true);go('home');return;}welcomeStep++;renderWelcome();}
function closeWelcome(completed){if(completed){try{localStorage.setItem('mydomWelcomeDone','1');}catch(e){}}welcome.classList.remove('show');document.querySelector('.app').inert=false;}
const welcomeSaveAddress=saveAddress;saveAddress=function(){welcomeSaveAddress();if(welcome.classList.contains('show')&&!document.getElementById('addressModal').classList.contains('show'))renderWelcome();};
const welcomeSaveAccount=saveAccount;saveAccount=function(){welcomeSaveAccount();if(welcome.classList.contains('show')&&!document.getElementById('accountModal').classList.contains('show'))renderWelcome();};
if(!localStorage.getItem('mydomWelcomeDone')&&!savedAddress&&!accounts.length&&!manualBills.length)startWelcome();

// Load the independent meter-history screen after the shared application is ready.
const meterModule=document.createElement("script");meterModule.src="meters.js";meterModule.onload=()=>{const apartmentsModule=document.createElement("script");apartmentsModule.src="apartments.js";document.body.append(apartmentsModule);};document.body.append(meterModule);

const cloudModule=document.createElement("script");cloudModule.src="cloud.js";document.body.append(cloudModule);
