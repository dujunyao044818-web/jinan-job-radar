import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect import iso_date,extract
S={'name':'测试医院','type':'医院','url':'https://jobs.example.org/list','domain':'jobs.example.org'}
class Tests(unittest.TestCase):
 def test_dates(self):
  self.assertEqual(iso_date('2026年09月28日'),'2026-09-28')
  self.assertIsNone(iso_date('不明'))
 def test_filter_dedupe(self):
  h='''<div>2026-09-28 <a href="/a">2026年博士研究生招聘公告</a><a href="/a">2026年博士研究生招聘公告</a><a href="/b">面试成绩公告及招聘通知</a><a href="https://bad.org/x">博士人才招聘信息</a></div>'''
  items=extract(h,S)
  self.assertEqual(len(items),1)
  self.assertTrue(items[0]['phd'])
  self.assertEqual(items[0]['url'],'https://jobs.example.org/a')
if __name__=='__main__':unittest.main()
