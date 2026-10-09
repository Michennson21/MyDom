(function(){
 const M=Management,el=id=>document.getElementById(id);
 function add(parent,tag,text,cls){const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;parent.append(x);return x;}
 function link(parent,text,url){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=add(parent,'a',text);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.style.display='block';}catch(_){}}
 function info(parent,r){
  add(parent,'p',M.labels[r.status],'muted');if(r.org)add(parent,'strong',r.org.name);
  if(r.status==='conflict')for(const id of new Set(r.entries.map(e=>e.orgId))){const org=M.organizations.find(x=>x.id===id);add(parent,'p',org?.name||id);}
  for(const e of r.entries)if(e.validFrom||e.validTo)add(parent,'p','Период по источнику: '+(e.validFrom||'не указан')+' — '+(e.validTo||'не указан'),'muted');
  if(r.org?.inn)add(parent,'p','ИНН: '+r.org.inn,'muted');
  if(r.org?.office)add(parent,'p','Адрес организации по каталогу: '+r.org.office,'muted');
  if(r.org?.phone){add(parent,'p','Телефон из открытого каталога; актуальность не подтверждена:','muted');const phone=r.org.phone.replace(/[^+0-9]/g,'');if(/^\+?\d{10,12}$/.test(phone)){const a=add(parent,'a',r.org.phone);a.href='tel:'+phone;}}
  const urls=[...new Set([r.org?.sourceUrl,...r.entries.map(x=>x.sourceUrl)].filter(Boolean))];for(const u of urls.slice(0,3))link(parent,'Источник сведений',u);
  if(r.status==='catalog'||r.status==='conflict')add(parent,'p','Снимок загружен '+M.data.checkedAt+'. Это не онлайн-проверка ГИС ЖКХ.','muted');
 }
 function persist(choice){
  if(!savedAddress)return;
  const next={...savedAddress};if(choice)next.managementOverride=choice;else delete next.managementOverride;
  const r=M.resolve(next);next.org=r.org?.name||'';next.orgSource=M.labels[r.status];
  const before=localStorage.getItem('mydomAddress'),registryBefore=localStorage.getItem('mydomApartmentsV1');
  try{const registry=JSON.parse(registryBefore||'null');if(registry){const home=registry.homes.find(x=>x.id===registry.active);if(home){home.address=next;home.data.mydomAddress=JSON.stringify(next);}}
   localStorage.setItem('mydomAddress',JSON.stringify(next));if(registry)localStorage.setItem('mydomApartmentsV1',JSON.stringify(registry));
  }catch(error){try{if(before===null)localStorage.removeItem('mydomAddress');else localStorage.setItem('mydomAddress',before);if(registryBefore===null)localStorage.removeItem('mydomApartmentsV1');else localStorage.setItem('mydomApartmentsV1',registryBefore);}catch(_){}alert('Не удалось сохранить выбор организации. Проверьте доступность хранилища.');return;}
  savedAddress=next;renderAll();
 }
 function render(){
  const card=el('orgCard');if(!card)return;card.replaceChildren();add(card,'h3','Управляющая организация');
  const r=M.resolve(savedAddress);if(!savedAddress){add(card,'p','Сначала выберите дом.');return;}info(card,r);
  const select=add(card,'select','','input');select.id='managementChoice';select.setAttribute('aria-label','Выбор управляющей организации');select.add(new Option('Определять по адресу',''));
  for(const o of [...M.organizations].sort((a,b)=>a.name.localeCompare(b.name,'ru')))select.add(new Option(o.name+(o.inn?' · '+o.inn:''),o.id));
  select.add(new Option('Указать другую организацию вручную','custom'));select.value=savedAddress.managementOverride?.orgId|| (savedAddress.managementOverride?'custom':'');
  const custom=add(card,'input','','input');custom.id='managementCustom';custom.placeholder='Название УК, ТСЖ или товарищества';custom.setAttribute('aria-label','Название организации');custom.maxLength=180;custom.value=savedAddress.managementOverride?.name||'';custom.hidden=select.value!=='custom';select.onchange=()=>custom.hidden=select.value!=='custom';
  const save=add(card,'button','Сохранить выбор организации','btn secondary block');save.id='saveManagement';save.onclick=()=>{if(!select.value)return persist(null);const org=M.organizations.find(x=>x.id===select.value);const name=org?.name||custom.value.trim();if(!name)return alert('Укажите название организации.');persist({orgId:org?.id||'',name,chosenAt:new Date().toISOString()});};
  add(card,'p','Ручной выбор относится только к этой квартире и не подтверждает договор управления.','muted');
  const directory=add(card,'details','');add(directory,'summary','Справочник организаций ('+M.organizations.length+')');add(directory,'p','Список неполный. Наличие в каталоге не подтверждает действующую лицензию.','muted');
  const search=add(directory,'input','','input');search.placeholder='Название или ИНН';search.setAttribute('aria-label','Поиск организации');const results=add(directory,'div','');
  const searchList=()=>{results.replaceChildren();const q=search.value.toLowerCase();for(const org of M.organizations.filter(o=>(o.name+' '+(o.inn||'')).toLowerCase().includes(q))){const row=add(results,'div','','row');add(row,'span',org.name+(org.inn?' · '+org.inn:''));link(row,'Источник',org.sourceUrl);}};search.oninput=searchList;searchList();
  const home=el('homeStatus');home.replaceChildren();add(home,'h3','Управляющая организация');add(home,'strong',r.org?.name||M.labels[r.status]);if(r.org)add(home,'p',M.labels[r.status],'muted');const button=add(home,'button','Сведения и выбор УК','btn secondary');button.onclick=()=>go('homeinfo');
  const provider=el('providersCard')?.querySelector('.provider-box');if(provider){provider.replaceChildren();add(provider,'strong','Управляющая организация');add(provider,'p',r.org?.name||'Не определена');add(provider,'p',M.labels[r.status],'muted');}
 }
 const original=renderAll;renderAll=function(){original();render();};
 const previousSelection=window.addressSelection;window.addressSelection=function(){const a=previousSelection();if(!a)return a;if(savedAddress&&M.key(a)===M.key(savedAddress)&&a.apartment===savedAddress.apartment&&savedAddress.managementOverride)a.managementOverride=savedAddress.managementOverride;const r=M.resolve(a);a.org=r.org?.name||'';a.orgSource=M.labels[r.status];return a;};
 function preview(){const privateHome=el('privateAddress').checked;const r=M.resolve({street:el('streetInput').value,house:el('manualHouse').value||el('houseSelect').value,isPrivate:privateHome});el('orgPreview').textContent=(r.org?r.org.name+' — ':'')+M.labels[r.status];}
 el('addressModal').addEventListener('change',preview);el('addressModal').addEventListener('input',preview);
 render();
})();
