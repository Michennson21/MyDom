import re,json,html,urllib.request,concurrent.futures,pathlib,time
# Public secondary directory; do not label this as a complete official GAR export.
listing=urllib.request.urlopen('https://kladr-rf.ru/07/000/001/000/?show_all_streets=1',timeout=30).read().decode()
entries=[(attrs,url,html.unescape(re.sub('<[^>]+>','',label))) for attrs,url,label in re.findall(r'<li([^>]*)>\s*<a href="(/07/000/001/000/[^"?]+/)"[^>]*>(.*?)</a>',listing) if not attrs]
cache=pathlib.Path('/tmp/mydom-address-pages');cache.mkdir(exist_ok=True)
def fetch(e):
 _,url,label=e;code='07000001000'+url.strip('/').split('/')[-1]+'00';p=cache/(code+'.html');error=None
 try:
  if p.exists():s=p.read_text()
  else:
   s=urllib.request.urlopen('https://kladr-rf.ru'+url,timeout=18).read().decode();p.write_text(s)
  cells=re.findall(r'<td data-label="Интервал домов">(.*?)</td>',s)
  houses=[html.unescape(re.sub('<[^>]+>','',v)).strip() for c in cells for v in c.split(',') if v.strip()]
  return {'code':code,'label':label,'houses':list(dict.fromkeys(houses)),'source':'https://kladr-rf.ru'+url}
 except Exception as ex:return {'code':code,'label':label,'houses':[],'source':'https://kladr-rf.ru'+url,'error':str(ex)}
result=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for item in pool.map(fetch,entries):
  result.append(item)
  if len(result)%40==0:print('processed',len(result),'failures',sum('error' in x for x in result),flush=True)
json.dump(result,open('/tmp/mydom-address-result.json','w'),ensure_ascii=False)
print('DONE',len(result),'failures',sum('error' in x for x in result),flush=True)
