import json,re,pathlib,sys,datetime
source=pathlib.Path(sys.argv[1]);rows=json.loads(source.read_text());failures=[r for r in rows if r.get('error')]
if failures and '--allow-partial' not in sys.argv:raise SystemExit(f'Failed pages: {len(failures)}; inspect and retry before publishing')
entries=[];date=datetime.date.today().isoformat()
for row in rows:
 label=row['label'];name=label;kind='';prefix=''
 for suffix,pref in [(' Территория СНТ','СНТ '),(' Территория ГСК','ГСК '),(' Проспект','пр-кт '),(' Переулок','пер. '),(' Улица','ул. '),(' Проезд','проезд '),(' Площадь','пл. '),(' Шоссе','ш. '),(' Территория',''),(' Парк','парк ')]:
  if label.endswith(suffix):name=label[:-len(suffix)];prefix=pref;kind=suffix.strip();break
 aliases=[name,label]
 if re.match(r'^(сдт|с/т|снт)\s+',name,re.I):aliases+=['СНТ '+re.sub(r'^(сдт|с/т|снт)\s+','',name,flags=re.I)]
 entries.append(dict(code=row['code'],street=prefix+name,houses=row['houses'],aliases=aliases,type=kind,source=row['source'],sourceLabel='КЛАДР-РФ · '+date+'; актуальность дома требует проверки'))
info={'date':date,'entries':len(entries),'failedPages':len(failures),'completeGAR':False}
script='/* Public secondary directory snapshot. Not a complete official GAR export. */\n(function(){const entries='+json.dumps(entries,ensure_ascii=False,separators=(',',':'))+';for(const entry of entries){const i=houseDB.findIndex(x=>x.code===entry.code);if(i>=0){const old=houseDB[i];entry.aliases.push(old.street);if(!entry.houses.length)entry.houses=old.houses;entry.gar=old.gar;houseDB[i]=entry;}else houseDB.push(entry);}window.addressCatalogInfo='+json.dumps(info)+';})();\n'
(pathlib.Path(__file__).resolve().parents[1]/'address-catalog.js').write_text(script)
print(json.dumps(info), 'house entries',sum(len(x['houses']) for x in entries))
