"""조사(읽기만): 나이스 교직원 온라인채용(edurecruit.go.kr) — 넥사크로 앱(/nxui)의 설정·화면 파일에서 공고 목록 데이터 주소 찾기"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl  # noqa: E402

B = 'https://edurecruit.go.kr/nxui/'


def get(path):
    try:
        f, body = crawl.get(B + path, timeout=30)
        print(f'● {path} len={len(body)}')
        return body
    except Exception as e:  # noqa: BLE001
        print(f'✗ {path} {str(e)[:60]}')
        return ''


idx = get('index.html')
for m in re.findall(r'["\']([^"\']+\.(?:js|json|xml))["\']', idx):
    if 'nexacrolib' not in m:
        print('  idx ->', m)
for p in ('environment.xml.js', 'typedefinition.xml.js', 'start.json', 'application.xadl.js', 'Application_Desktop.xadl.js', 'appvariables.xml.js'):
    body = get(p)
    for m in re.finditer(r'(?:url|prefixid|services|this\.set_|_addService|addService|_setServices)[^;\n]{0,200}', body, re.I):
        print('   ', m.group(0)[:220])
    forms = sorted(set(re.findall(r'[\w/]+\.xfdl', body)))[:40]
    if forms:
        print('   forms:', forms)
# 공고 관련 화면 후보 불러 보기
for cand in re.findall(r'[\w/]*(?:rcrt|recr|ntc|notice|pbanc|job|empl|hire)[\w/]*\.xfdl', idx + ''.join(get(x) for x in ()), re.I)[:10]:
    get(cand + '.js')
