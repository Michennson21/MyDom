"""Read public JSON-LD company catalogs; secondary source, not official GIS integration."""
import json,re,pathlib,urllib.request,urllib.parse,datetime,concurrent.futures,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCES=[('idar','https://domscanner.ru/houses/companies/ooo-uk-idar-c6e7ab01/'),('municipal','https://domscanner.ru/houses/companies/mup-munitsipalnaya-upravlyayuschaya-kompaniya-aa0a7df4/'),('estetika','https://domscanner.ru/houses/companies/ooo-uk-estetika-38f6f70d/')]
def parse(s,url):
 graphs=[]
 for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',s,re.S):graphs+=json.loads(raw).get('@graph',[])
 org=next(x for x in graphs if x.get('@type')=='Organization' and x.get('taxID'))
 listing=next(x for x in graphs if x.get('@type')=='ItemList')
 updated=re.search(r'Обновлено.*?</dt>\s*<dd[^>]*>(.*?)</dd>',s,re.S)
 next_link=re.search(r'<a\s+rel="next"\s+href="([^"]+)"',s)
 return org,listing,urllib.parse.urljoin(url,next_link[1]) if next_link else None,re.sub('<[^>]*>','',updated[1]).strip() if updated else None
def fetch_company(pair):
 slug,base=pair;url=base;homes=[];seen=set();org=None;total=None;updated=None
 while url:
  if url in seen or len(seen)>10:raise ValueError('Invalid pagination')
  if not url.startswith(base):raise ValueError('Unexpected page host/path')
  seen.add(url)
  cache=pathlib.Path('/tmp/management-pages');cache.mkdir(exist_ok=True);f=cache/(slug+('-2' if '?' in url else '')+'.html')
  s=f.read_text() if '--use-cache' in sys.argv and f.exists() else urllib.request.urlopen(url,timeout=25).read().decode()
  f.write_text(s);o,listing,url,u=parse(s,url);org=o;updated=updated or u;total=listing['numberOfItems']
  for item in listing['itemListElement']:
   m=re.fullmatch(r'(?:г\.\s*)?Нальчик,\s*(.+?),\s*дом\s+(.+)',item['name'])
   if m:homes.append({'street':m[1],'house':m[2],'orgId':o['taxID'],'sourceUrl':item['url'],'sourceKind':'secondary','checkedAt':datetime.date.today().isoformat()})
 # No claim that all company houses are in Nalchik or that this catalog is complete GAR.
 entity={'id':org['taxID'],'name':org['name'],'inn':org['taxID'],'office':org.get('address',''),'phone':org.get('telephone',''),'sourceUrl':base,'sourceKind':'secondary','sourceUpdated':updated,'checkedAt':datetime.date.today().isoformat()}
 return entity,homes
if __name__=='__main__':
 organizations=[];assignments=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for org,homes in pool.map(fetch_company,SOURCES):organizations.append(org);assignments+=homes
 seed=json.loads((ROOT/'scripts/management-directory-seed.json').read_text())
 ids={o['id'] for o in organizations}
 for name,inn in seed['entries']:
  if inn not in ids:organizations.append({'id':inn,'inn':inn,'name':name,'sourceKind':'secondary','sourceUrl':seed['sourceUrl'],'checkedAt':seed['checkedAt']});ids.add(inn)
 for entry in assignments:
  if (entry['orgId'],entry['street'],entry['house']) in [('0726015230','улица Калинина','75'),('0700029189','улица Щаденко','20А')]:entry.update(validFrom='2026-06-24',validTo='2027-06-23',periodSource=entry['sourceUrl'])
 data={'checkedAt':datetime.date.today().isoformat(),'complete':False,'organizations':organizations,'assignments':assignments}
 (ROOT/'management-data.js').write_text('/* Secondary public snapshot; not an official current management register. */\nwindow.managementData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
 print('organizations',len(organizations),'Nalchik assignments',len(assignments))
