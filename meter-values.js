/* Shared reading formats. Values are cumulative, never payment amounts. */
(function(root){
 const supported=['Холодная вода','Горячая вода','Электроэнергия','Газ','Тепло'];
 function count(m){return m.kind==='Электроэнергия'?Number(m.tariffCount||1):1;}
 function unit(m){return m.kind==='Электроэнергия'?'кВт·ч':m.kind==='Тепло'?(m.unit||'Гкал'):'м³';}
 function eligible(m){return supported.includes(m.kind)&&m.status!=='archived'&&(m.kind!=='Тепло'||m.individual===true);}
 function parse(raw){const s=String(raw).trim().replace(',','.');if(!/^\d{1,9}(?:\.\d{1,3})?$/.test(s))throw Error('Введите неотрицательное число: до 9 цифр целой части и 3 после запятой.');return Number(s);}
 function values(r){return r.tariffs||{T1:r.value};}
 function format(r){const v=values(r),multi=Object.keys(v).length>1;return Object.entries(v).map(([k,n])=>(multi?k.replace('T','Т')+': ':'')+n+' '+unit(r)).join(' · ');}
 function delta(a,b){if(!b||unit(a)!==unit(b))return '';const av=values(a),bv=values(b),keys=Object.keys(av);if(keys.length!==Object.keys(bv).length||keys.some(k=>bv[k]===undefined||av[k]<bv[k]))return '';return keys.map(k=>(keys.length>1?k.replace('T','Т')+': ':'')+(Math.round(av[k]*1000)-Math.round(bv[k]*1000))/1000+' '+unit(a)).join(' · ');}
 function check(current,previous){if(!previous)return;const a=values(current),b=values(previous);if(unit(current)!==unit(previous)||Object.keys(a).length!==Object.keys(b).length)throw Error('Единицы или тарифы отличаются от предыдущей записи. Проверьте карточку прибора.');for(const k of Object.keys(a))if(b[k]===undefined||a[k]<b[k])throw Error((Object.keys(a).length>1?k+': ':'')+'значение меньше предыдущего ('+b[k]+' '+unit(previous)+'). Проверьте ввод; для замены прибора создайте новую карточку.');}
 const api={supported,count,unit,eligible,parse,values,format,delta,check};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MeterValues=api;
})(globalThis);
