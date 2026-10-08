#!/usr/bin/env python3
"""Public-listing collection; never claims to verify a job's eligibility or deadline."""
import json, re, sys, hashlib, time, os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCES = json.loads((ROOT / 'scripts/sources.json').read_text(encoding='utf-8'))
OUTPUT = ROOT / 'site/data/jobs.json'
HEADERS = {'User-Agent': 'JinanJobRadar/0.1 (public recruitment monitoring; respectful access)', 'Accept-Language':'zh-CN,zh;q=0.9'}
POSTITIVE = re.compile(r'招聘|招收|引进|聘用|诚聘|人才|博士后|岗位|招募')
NEGATIVE = re.compile(r'拟聘|公示|面试|笔试|成绩|资格复审|资格审查|体检|录取|考试安排|进修|培训班|住院医师规范化培训|规培')
PHD = re.compile(r'博士|高层次人才|教授|研究员|学科带头人|科研岗|教师')
DATE = re.compile(r'(?<!\d)(20\d{2})[年./-](0?[1-9]|1[0-2])[月./-](3[01]|[12]\d|0?[1-9])日?')
END = re.compile(r'(?:报名|申请|申报)(?:时间|期限|截止(?:时间|日期)?)?[^。；\n]{0,90}?(?:至|截止(?:到|至)?|结束于)\s*(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)')
LOCAL = timezone(timedelta(hours=8))

def iso_date(text):
    m = DATE.search(text or '')
    if not m: return None
    try: return datetime(*(int(x) for x in m.groups())).date().isoformat()
    except ValueError: return None

def valid_link(url, source):
    parsed = urlparse(url)
    return parsed.scheme in ('http','https') and parsed.hostname == source['domain'] and not re.search(r'\.(?:jpg|png|gif|css|js|pdf|docx?|xlsx?|zip)(?:$|\?)', parsed.path, re.I)

def extract(html, source):
    soup = BeautifulSoup(html, 'html.parser')
    seen = {}
    for a in soup.select('a[href]'):
        title = re.sub(r'\s+', ' ', a.get_text(' ', strip=True)).strip('·-—> ')
        if not (8 <= len(title) <= 150 and POSTITIVE.search(title) and not NEGATIVE.search(title)): continue
        url = urldefrag(urljoin(source['url'], a.get('href', '')))[0]
        if not valid_link(url, source): continue
        # A date must be near the listing entry, not a date unrelated to that entry.
        nearby = a.parent.get_text(' ', strip=True)[:230] if a.parent else title
        dt = iso_date(nearby.replace(title,'',1)) or iso_date(title)
        key = hashlib.sha256((source['name']+'|'+url).encode()).hexdigest()[:16]
        seen[key] = {'id':key,'source':source['name'],'type':source['type'],'title':title,
            'url':url,'published':dt,'deadline':None,'phd':bool(PHD.search(title)),
            'deadline_status':'未核实','collected_at':datetime.now(LOCAL).isoformat(timespec='seconds')}
    return list(seen.values())

def detail_deadline(url, session):
    """Only capture explicitly labelled full-date recruitment deadlines from detail text."""
    r = session.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or 'utf-8'
    soup = BeautifulSoup(r.text, 'html.parser')
    for tag in soup(['script','style','nav','footer','header']): tag.decompose()
    content = re.sub(r'\s+', ' ', soup.get_text(' ', strip=True))
    hits = [iso_date(m.group(1)) for m in END.finditer(content)]
    hits = [h for h in hits if h]
    return hits[-1] if hits else None

def main():
    old = {}
    if OUTPUT.exists():
        try: old = json.loads(OUTPUT.read_text(encoding='utf-8'))
        except (ValueError,OSError): pass
    records = {j['id']:j for j in old.get('jobs',[]) if j.get('id')}
    statuses = []
    session = requests.Session()
    for src in SOURCES:
        try:
            r = requests.get(src['url'], headers=HEADERS, timeout=20)
            r.raise_for_status(); r.encoding = r.apparent_encoding or 'utf-8'
            fresh = extract(r.text,src)
            if not fresh: raise ValueError('未识别到招聘条目，可能是网站结构变化或访问受限')
            detail_budget = 12  # per source per run; avoid excessive load
            for job in fresh:
                before = records.get(job['id'])
                if before:
                    job['first_seen'] = before.get('first_seen',job['collected_at'])
                    # Keep known published date if the current listing omits one.
                    job['published'] = job['published'] or before.get('published')
                else: job['first_seen'] = job['collected_at']
                if before and before.get('deadline'):
                    job['deadline'] = before['deadline']
                    job['deadline_status'] = before.get('deadline_status','候选日期，需核实')
                elif detail_budget > 0:
                    detail_budget -= 1
                    try:
                        dl = detail_deadline(job['url'], session)
                        if dl:
                            job['deadline'] = dl
                            job['deadline_status'] = '从公告正文提取，需核实'
                    except (requests.RequestException, ValueError): pass
                    time.sleep(0.35)
                records[job['id']] = job
            statuses.append({'name':src['name'],'url':src['url'],'status':'ok','found':len(fresh),'error':''})
        except (requests.RequestException,ValueError) as e:
            statuses.append({'name':src['name'],'url':src['url'],'status':'error','found':0,'error':str(e)[:170]})
        time.sleep(1)
    # Keep previous announcements: useful historical archive, not a statement of vacancy status.
    jobs = sorted(records.values(), key=lambda x:(x.get('published') or '', x.get('first_seen') or ''), reverse=True)[:2000]
    document = {'updated_at':datetime.now(LOCAL).isoformat(timespec='seconds'),'sources':statuses,'jobs':jobs,
                'disclaimer':'公告索引仅供参考；是否招聘、报名期限、学历专业要求以原文与附件为准。'}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Sources OK:',sum(s['status']=='ok' for s in statuses),'/',len(statuses),'| indexed:',len(jobs))
    for s in statuses: print(s['name'],s['status'],s['found'],s['error'])
    if all(s['status']=='error' for s in statuses): sys.exit(1)

if __name__ == '__main__': main()
