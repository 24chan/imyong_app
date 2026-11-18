# 자동 수집기 (GitHub Actions)

교육청 임용 게시판 → 공고·첨부(HWP/HWPX/PDF) → 숫자 추출 → Supabase `ingest_queue`(검수 대기) → 운영자 승인 → 본 테이블

## 진행
- [x] 0단계 접속 확인 `collector-probe` (2026-11-18): 14/17
- [x] 1단계 준비 게시판 링크 구조 조사 `collector-survey` (2026-11-18)
- [x] 1단계 지역별 목록 → 상세 → 첨부 URL 수집 `collector-crawl` (14/17)
- [x] 2단계 첨부 다운로드 + 분류 `collector-fetch` (지역별 병렬) → `raw-files` 브랜치 (2026-11-18, 약 360MB)
- [x] 3단계 표 추출 — 초등 1차·최종 (hwpx XML / pdf 표+글자배치 / xlsx / hwp→pyhwp 변환) + 교육부 확정 인원과 합계 대조
  - 결과: 11개 지역 30개 연도 묶음, 검증 전부 통과 (2026-11-18)
  - [ ] 중등(과목별, 2단 머리글 표) 파서
- [ ] 4단계 ingest_queue 저장 `collector-ingest` (fetch 끝나면 자동 실행) — GitHub Secret `SUPABASE_SECRET_KEY` 등록 대기
- 인천·세종·전남: 해외 차단 → 사용자가 공고 파일을 대화에 올리면 처리 (2026-11-18 결정 A)
- [ ] 5단계 하루 1회 자동 실행(cron), 시즌엔 더 자주 / 새 공고 알림

## 게시판 현황 (2026-11-18, `collector-crawl` 기준)
목록 → 상세 → 첨부파일 주소까지 자동으로 되는 곳: **14/17**

| 지역 | 게시판 | 첨부 방식 | 상태 |
|---|---|---|---|
| 서울 | sen BD_selectBbsList q_bbsSn=1094 | ND_fileDownload | OK |
| 부산 | pen selectNttList mi=30361 bbsId=2342 | RAONK 스크립트 /upload/... | OK |
| 대구 | dge selectNttList mi=10179 bbsId=3913 (쿠키 필요) | /upload/... | OK |
| 인천 | ice mi=10991 bbsId=1777 | — | 해외 접속 시 /law/main.do 로 돌려보냄 |
| 광주 | gen xboard tbnum=49 | downpost | OK |
| 대전 | dje boardCnts boardID=64 (goView) | fileDown.do | OK |
| 울산 | use BD_selectBbsList q_bbsSn=1913 | ND_fileDownload | OK |
| 세종 | sje | — | 해외 시간 초과 |
| 경기 | goe selectNttList mi=10154 bbsId=2583 | /resource/... (미리보기 onclick) | OK |
| 강원 | gwe bbs/list.do key=… (goView→view.do bbsSn) | cmm/fileDown.do | OK |
| 충북 | cbe mi=11700 bbsId=1793(초등)/1794(중등) | DEXT5 스크립트 /upload/... | OK |
| 충남 | cne boardCnts boardID=47 (goView) | fileDown.do | 목록 OK, 가끔 시간 초과 |
| 전북 | jbe board BBS_0000043 (초등/중등 menuCd) | download.jbe | OK |
| 전남 | jne | — | 해외 시간 초과 (전남광주 통합교육청, 주소 변경 가능성) |
| 경북 | gbe mi=3538 bbsId=1882 | /upload/... | OK, 느림(지연 4초+재시도) |
| 경남 | gne BD_selectBbsList q_bbsSn=1251 | ND_fileDownload | OK |
| 제주 | jje board BBS_0000002 | download.jje | OK |

참고: 목록은 최근 3쪽만 봄. 2024~2026 과거 합격 공고는 게시판 검색(키워드 '합격')으로 2단계에서 따로 수집.

## 해외 차단 대안 (세종·전남·인천 등)
- 국내 IP가 필요한 곳은 (a) 사용자가 공고 파일을 직접 올리기, (b) 국내 클라우드 무료 실행 환경, (c) 컴퓨터 세션 때 자체 실행기(self-hosted runner) 중 선택

## 학교 위치 (`collector-schools`)

- 공공데이터포털 **전국초중등학교위치표준데이터** API (GitHub Secret `DATA_GO_KR_KEY`)
- 매달 4일 새벽 자동 실행 (Actions 탭에서 `collector-schools` → Run workflow 로 바로 실행 가능)
- 결과: `raw-files` 브랜치 `raw/schools/<지역>.json`, `meta.json` → 앱 '학교 지도'가 직접 읽음 (DB·승인 불필요)
- 항목: `[학교명, 학교급 e/m/h, 설립 p공립/s사립/n국립, 위도, 경도, 시군구]`
- 2026.7 출범한 **전남광주통합특별시** 주소는 임용이 아직 따로라서 옛 경계(광주 5개 구)로 광주·전남을 나눔
