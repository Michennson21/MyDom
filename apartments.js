/* Compatibility layer: each apartment keeps its own local workspace.
   The active workspace keys remain the source of truth until a switch. */
(function(){
 const registryKey='mydomApartmentsV1';
 const workspaceKeys=['mydomAddress','mydomAccounts','mydomManualBills','mydomResidentIssues','mydomWater','mydomMeterHistory'];
 const snapshot=()=>Object.fromEntries(workspaceKeys.map(k=>[k,localStorage.getItem(k)]));
 const apply=data=>{for(const k of workspaceKeys){if(data[k]==null)localStorage.removeItem(k);else localStorage.setItem(k,data[k]);}};
 const identity=a=>JSON.stringify([a.street,a.house,a.apartment].map(v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim()));
 let registry;
 try{registry=JSON.parse(localStorage.getItem(registryKey)||'null');if(registry&&(!Array.isArray(registry.homes)||!registry.homes.some(h=>h.id===registry.active)))throw Error('invalid registry');}
 catch(e){alert('Не удалось открыть список квартир. Существующие данные не изменены.');return;}
 if(!registry){registry={active:null,homes:[]};if(savedAddress){const id=crypto.randomUUID();registry={active:id,homes:[{id,address:savedAddress,data:snapshot()}]};try{localStorage.setItem(registryKey,JSON.stringify(registry));}catch(e){alert('Не удалось сохранить список квартир. Данные не изменены.');return;}}}
 const panel=document.createElement('div');panel.className='card';panel.id='apartmentSwitcher';document.querySelector('.content').prepend(panel);
 function render(){const addressButton=document.querySelector('#home .address button');if(addressButton)addressButton.textContent='Выбрать / добавить квартиру';panel.innerHTML='<label class="formlabel" for="activeApartment">Ваша квартира</label><div><select id="activeApartment" class="input">'+(registry.homes.length?registry.homes.map(h=>'<option value="'+h.id+'"'+(h.id===registry.active?' selected':'')+'>'+escapeHtml(h.address.street+', '+h.address.house+', кв. '+h.address.apartment)+'</option>').join(''):'<option>Квартира не добавлена</option>')+'</select><button id="addApartment" class="btn secondary block">+ Квартира</button></div><div class="muted" style="margin-top:8px">Счета, начисления и показания относятся к выбранной квартире.</div>';
 document.getElementById('addApartment').onclick=()=>{openAddress();document.querySelector('#addressModal h3').textContent='Добавить квартиру';};
 document.getElementById('activeApartment').onchange=e=>switchTo(e.target.value);
 }
 function commit(next,data){
  const before=snapshot(),oldRegistry=localStorage.getItem(registryKey);
  try{apply(data);localStorage.setItem(registryKey,JSON.stringify(next));}
  catch(error){try{apply(before);if(oldRegistry===null)localStorage.removeItem(registryKey);else localStorage.setItem(registryKey,oldRegistry);}catch(rollbackError){alert('Хранилище браузера недоступно. Не продолжайте ввод до перезагрузки страницы.');return false;}alert('Не удалось переключить квартиру. Данные оставлены без изменений.');render();return false;}
  registry=next;return true;
 }
 function withCurrent(){const next=JSON.parse(JSON.stringify(registry));const current=next.homes.find(h=>h.id===next.active);if(current){current.data=snapshot();current.address=savedAddress;}return next;}
 function switchTo(id){if(id===registry.active)return;const next=withCurrent(),target=next.homes.find(h=>h.id===id);if(!target)return;next.active=id;if(commit(next,target.data)){location.reload();}}
 // A changed address creates/selects another apartment; it never relabels existing bills.
 saveAddress=function(){
  const st=document.getElementById('streetInput').value.trim(),house=document.getElementById('houseSelect').value,apartment=document.getElementById('apartmentInput').value.trim();
  if(!st||!house||!apartment){alert('Выберите улицу, дом и укажите квартиру.');return;}
  const db=findStreet(st);if(!db){alert('Выберите улицу из подсказок.');return;}
  const canonicalHouse=[...db.houses].find(h=>normalizeHouse(h)===normalizeHouse(house))||house,org=findOrg(db.street,canonicalHouse);
  const address={street:'ул. '+db.street,house:canonicalHouse,apartment,org:org?org.org:'',orgSource:org?org.source:'',gar:db.gar};
  const next=withCurrent();let target=next.homes.find(h=>identity(h.address)===identity(address));
  if(!target){const data=next.homes.length?Object.fromEntries(workspaceKeys.map(k=>[k,null])):snapshot();data.mydomAddress=JSON.stringify(address);target={id:crypto.randomUUID(),address,data};next.homes.push(target);}
  next.active=target.id;
  if(!commit(next,target.data))return;
  if(!savedAddress){savedAddress=address;renderAll();closeAddress();render();if(typeof welcome!=='undefined'&&welcome.classList.contains('show'))renderWelcome();}
  else location.reload();
 };
 // Another tab changing apartments must not keep writing with stale account state.
 window.addEventListener('storage',e=>{if(e.key===registryKey)location.reload();});
 render();
})();
