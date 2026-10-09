"""Public-source collectors; Python 3.11+, stdlib only. No user/address data sent."""
import argparse,datetime as dt,hashlib,json,os,pathlib,re,time,urllib.request
from html.parser import HTMLParser
from zoneinfo import ZoneInfo
MSK=ZoneInfo('Europe/Moscow')
POWER='https://www.rossetisk.ru/press_center/disconnects/'
WATER='https://t.me/s/mup_nalchikskii_vodokanal'
class Node:
 def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
 def all(self):
  yield self
  for c in self.children:
   if isinstance(c,Node):yield from c.all()
 def text(self):
  if self.tag in ('script','style'):return ''
  s=''.join(c.text() if isinstance(c,Node) else c for c in self.children)
  return s+ ('\n' if self.tag in ('br','p','div','h1','h2','h3','h4') else '')
 def has(self,cls):return cls in self.attrs.get('class','').split()
class HTML(HTMLParser):
 def __init__(self,s):
  super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(s)
 def handle_starttag(self,t,a):
  n=Node(t,a);self.stack[-1].children.append(n)
  if t not in ('br','img','meta','link','hr','input','source','wbr'):self.stack.append(n)
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==t:self.stack=self.stack[:i];break
 def handle_data(self,s):self.stack[-1].children.append(s)
def text(s):return re.sub(r'[ \t\r\xa0]+',' ',HTML(s).root.text()).strip()
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'MyDom-PublicNotices/0.1','Accept':'text/html'})
 with urllib.request.urlopen(req,timeout=20) as r:
  data=r.read(2_000_001)
  if len(data)>2_000_000:raise ValueError('Response exceeds 2 MB')
  s=data.decode('utf-8')
  if re.search(r'<(?:title|h1)[^>]*>[^<]*(?:site unavailable|access denied|captcha)',s,re.I):raise ValueError('Source unavailable or access restricted')
  return s
def stamp():return dt.datetime.now(dt.timezone.utc).isoformat()
def event(url,source,service,body,part='0',published=None,start=None,end=None):
 fingerprint=hashlib.sha256(json.dumps([body,start,end],ensure_ascii=False).encode()).hexdigest()
 return dict(id=hashlib.sha256((url+'#'+part).encode()).hexdigest()[:24],source=source,sourceUrl=url,service=service,title='Объявление: '+service,description=body,publishedAt=published,start=start,end=end,contentHash=fingerprint,scope={'city':'Нальчик','type':'unparsed','ambiguous':True},reviewRequired=True,lifecycle='unconfirmed')
def simple_scope(body):
 # Only a bare list of named streets is unambiguous enough. Numbers, limits and districts stay unresolved.
 m=re.fullmatch(r'\s*(?:ул\.|улицы|улица)\s+([А-Яа-яЁё ,.-]+?)\.?\s*',body)
 if not m or re.search(r'част|район|\bот\b|\bдо\b|между|огранич|сдт|снт',body,re.I):return None
 names=[x.strip().rstrip('.') for x in m[1].split(',')]
 if not names or any(not x or len(x)>70 for x in names):return None
 return {'city':'Нальчик','type':'streets','streets':names,'complete':True}
def power_links(s):
 links=[]
 for n in HTML(s).root.all():
  href=n.attrs.get('href','')
  if href.startswith('/press_center/disconnects/grafik-') and href.endswith('/'):
   u='https://www.rossetisk.ru'+href
   if u not in links:links.append(u)
 if not links:raise ValueError('Power listing structure not recognized')
 return links[:4]
def parse_power(s,url):
 if '<h1' not in s.lower():raise ValueError('Article structure not recognized')
 m=re.search(r'<h3[^>]*>\s*Кабардино-Балкарская Республика\s*</h3>(.*?)(?=<h3|</main)',s,re.S|re.I)
 if not m:
  if re.search(r'<h3[^>]*>.*?Республика',s,re.S):return []
  raise ValueError('Regional headings not recognized')
 body=text(m[1]);city=re.search(r'г\.\s*Нальчик\b(.*?)(?=\n\s*(?:г|с|ст|п|а)\.\s|$)',body,re.S)
 if not city:return []
 body=city[1].strip();day=re.search(r'-na-(\d{2})-(\d{2})-(\d{4})-g/$',url)
 date=None
 if day:
  d,m,y=map(int,day.groups());date=dt.date(y,m,d)
 blocks=list(re.finditer(r'(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})',body))
 if not blocks:return [event(url,'Россети Северный Кавказ','Электричество',body)]
 result=[]
 for i,b in enumerate(blocks):
  fragment=body[b.end():blocks[i+1].start() if i+1<len(blocks) else len(body)].strip()
  start=end=None
  if date:
   def instant(t):return dt.datetime.combine(date,dt.time.fromisoformat(t.replace('.',':')),MSK).isoformat()
   start,end=instant(b[1]),instant(b[2])
   if end<=start:end=None
  e=event(url,'Россети Северный Кавказ','Электричество',fragment,str(i),start=start,end=end)
  scope=simple_scope(fragment)
  if scope:e['scope']=scope
  e['reviewRequired']=not bool(scope and start);result.append(e)
 return result
def parse_water(s):
 root=HTML(s).root;posts=[n for n in root.all() if n.has('tgme_widget_message') and n.attrs.get('data-post')]
 if not posts:raise ValueError('Telegram public feed structure not recognized')
 result=[]
 for post in posts:
  nodes=list(post.all());content=next((n for n in nodes if n.has('tgme_widget_message_text')),None)
  if not content:continue
  body=content.text().strip()
  if not re.search(r'отключ|огранич|авари|восстанов|ремонт|подач|водоснабж',body,re.I):continue
  pid=post.attrs['data-post']
  if not re.fullmatch(r'mup_nalchikskii_vodokanal/\d+',pid):continue
  published=next((n.attrs.get('datetime') for n in nodes if n.tag=='time'),None)
  e=event('https://t.me/'+pid,'Нальчикский водоканал','Вода',body,published=published)
  # Dates, cancellations and restorations remain visible as original notices; never infer an active outage.
  result.append(e)
 return result
def merge_source(previous,source,items,now,error=None):
 old=previous.get('sources',{}).get(source,{})
 status={'checkedAt':now,'lastSuccessAt':old.get('lastSuccessAt'),'state':'error' if error else 'ok','error':error}
 if error:return [x for x in previous.get('events',[]) if x.get('sourceId')==source],status
 status['lastSuccessAt']=now
 old_items={x['id']:x for x in previous.get('events',[]) if x.get('sourceId')==source}
 for e in items:
  before=old_items.get(e['id']);e.update(sourceId=source,fetchedAt=now,firstSeenAt=before.get('firstSeenAt',now) if before else now,changedAt=before.get('changedAt',now) if before and before.get('contentHash')==e['contentHash'] else now)
 return list({e['id']:e for e in items}.values()),status
def collect(previous,request=fetch):
 now=stamp();out={'schemaVersion':1,'checkedAt':now,'sources':{},'events':[]}
 for source in ('power','water'):
  try:
   if source=='power':
    items=[]
    for url in power_links(request(POWER)):items.extend(parse_power(request(url),url))
   else:items=parse_water(request(WATER))
   entries,status=merge_source(previous,source,items,now)
  except Exception as ex:entries,status=merge_source(previous,source,[],now,str(ex)[:250])
  out['events'].extend(entries);out['sources'][source]=status
 return out
def write_atomic(path,data):
 path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2));os.replace(tmp,path)
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--watch',action='store_true');p.add_argument('--interval',type=int,default=1800);a=p.parse_args()
 if a.interval<300:p.error('Minimum interval: 300 seconds')
 while True:
  path=pathlib.Path(a.output);previous=json.loads(path.read_text()) if path.exists() else {};out=collect(previous);write_atomic(path,out)
  print(json.dumps({'events':len(out['events']),'sources':out['sources']},ensure_ascii=False),flush=True)
  if not a.watch:break
  time.sleep(a.interval)
if __name__=='__main__':main()
