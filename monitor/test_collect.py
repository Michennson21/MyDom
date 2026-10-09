import unittest
from collect import parse_power,parse_water,power_links,merge_source,collect,POWER,WATER
URL=POWER+'grafik-planovykh-ogranicheniy-elektrosnabzheniya-v-regionakh-skfo-na-09-10-2026-g/'
PAGE='<h1>График</h1><h3>Кабардино-Балкарская Республика</h3><p>г. <b>Нальчик</b><br>09:30-12:30<br>ул. Первая, Вторая.<br>13:00-15:00<br>частично район Центр<br>г. Тырныауз<br>09:00-18:00<br>ул. Другая</p><h3>Республика Дагестан</h3>'
class Tests(unittest.TestCase):
 def test_power_town_time_and_uncertainty(self):
  x=parse_power(PAGE,URL);self.assertEqual(len(x),2);self.assertEqual(x[0]['scope']['streets'],['Первая','Вторая']);self.assertEqual(x[0]['start'],'2026-10-09T09:30:00+03:00');self.assertTrue(x[1]['reviewRequired']);self.assertNotIn('Тырныауз',str(x))
 def test_multi_date_not_guessed(self):
  x=parse_power(PAGE,URL.replace('-09-10-','-09-i-10-10-'));self.assertIsNone(x[0]['start']);self.assertTrue(x[0]['reviewRequired'])
 def test_water_original_notice_no_inferred_restoration(self):
  s='<div class="tgme_widget_message" data-post="mup_nalchikskii_vodokanal/123"><div class="tgme_widget_message_text">Водоснабжение пока не восстановлено.<br>Работы продолжаются.</div><time datetime="2026-10-09T05:00:00+00:00"></time></div>'
  x=parse_water(s);self.assertEqual(len(x),1);self.assertEqual(x[0]['lifecycle'],'unconfirmed');self.assertIn('не восстановлено',x[0]['description']);self.assertTrue(x[0]['reviewRequired'])
 def test_error_page_not_empty_success(self):
  with self.assertRaises(ValueError):parse_water('<h1>Site Unavailable</h1>')
  with self.assertRaises(ValueError):power_links('<h1>Error</h1>')
 def test_keep_last_success_when_source_fails(self):
  old={'events':[{'id':'x','sourceId':'water'}],'sources':{'water':{'lastSuccessAt':'old'}}};events,status=merge_source(old,'water',[],'now','error');self.assertEqual(events,old['events']);self.assertEqual(status['lastSuccessAt'],'old');self.assertEqual(status['state'],'error')
 def test_repeat_update_dedup_and_partial_failure(self):
  def request(url):
   if url==POWER:return '<a href="'+URL.replace('https://www.rossetisk.ru','')+'">График</a>'
   if url==WATER:raise ValueError('unavailable')
   return PAGE
  x=collect({},request);y=collect(x,request);self.assertEqual(len(y['events']),2);self.assertEqual(x['events'][0]['changedAt'],y['events'][0]['changedAt']);self.assertEqual(y['sources']['water']['state'],'error');self.assertEqual(y['sources']['power']['state'],'ok')
if __name__=='__main__':unittest.main()
