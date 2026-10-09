const {test}=require('node:test'),assert=require('node:assert/strict');
const {match,key}=require('../outage-matcher.js');
const home={street:'ул. Ленина',house:'12',city:'Нальчик'};
const run=(scope,a=home,locations={})=>match({scope:{city:'Нальчик',...scope}},a,locations).status;
test('exact addresses preserve fractions and suffixes',()=>{
 const s={type:'addresses',addresses:[{street:'Ленина',house:'двлд12'}],complete:true};assert.equal(run(s),'exact');assert.equal(run(s,{...home,house:'12/1'}),'outside');assert.equal(run({...s,complete:false},{...home,house:'15'}),'possible');
});
test('number range, parity, unknown suffix coverage',()=>{
 const s={type:'range',street:'Ленина',from:2,to:20,parity:'even',complete:true};assert.equal(run(s),'exact');assert.equal(run(s,{...home,house:'13'}),'outside');assert.equal(run(s,{...home,house:'12А'}),'possible');assert.equal(run({...s,includeSuffixes:true},{...home,house:'12А'}),'exact');assert.equal(run({...s,from:30}),'possible');
});
test('missing or ambiguous descriptions never imply outside',()=>{
 assert.equal(run({type:'district',name:'Центр'}),'possible');assert.equal(run({type:'range',ambiguous:true}),'possible');assert.equal(match({},home).status,'possible');
});
const polygon={type:'polygon',city:'Нальчик',verified:true,source:'synthetic test boundary',accuracyM:2,complete:true,geometry:{type:'Polygon',coordinates:[[[43,43],[44,43],[44,44],[43,44],[43,43]]]}};
const loc=p=>({[key(home)]:{point:p,verified:true,source:'synthetic test house',accuracyM:3}});
test('polygon inside, outside and boundary uncertainty',()=>{
 assert.equal(run(polygon,home,loc([43.5,43.5])),'zone');assert.equal(run(polygon,home,loc([44.5,43.5])),'outside');assert.equal(run(polygon,home,loc([43,43.5])),'possible');assert.equal(run(polygon,home,loc([43.00001,43.5])),'possible');
});
test('holes exclude homes; incomplete bounds do not exclude',()=>{
 const p={...polygon,geometry:{type:'Polygon',coordinates:[...polygon.geometry.coordinates,[[43.2,43.2],[43.8,43.2],[43.8,43.8],[43.2,43.8],[43.2,43.2]]]}};
 assert.equal(run(p,home,loc([43.5,43.5])),'outside');assert.equal(run({...p,complete:false},home,loc([43.5,43.5])),'possible');
});
test('coordinates must be sourced and bound to exact house',()=>{
 assert.equal(run(polygon),'possible');assert.equal(run(polygon,{...home,house:'14'},loc([43.5,43.5])),'possible');assert.equal(run({...polygon,verified:false},home,loc([43.5,43.5])),'possible');assert.equal(run({...polygon,geometry:{type:'Polygon',coordinates:[]}},home,loc([43.5,43.5])),'possible');
});
