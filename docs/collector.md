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

## 매일 자동 수집 (2026-11-19~)

- `collector-fetch`가 매일 05:17(한국 시간)에 전체 지역을 돌고, 끝나면 `collector-ingest`가 이어서 실행
- 새 숫자는 대기열에만 들어가고, 앱 반영은 Supabase에서 `select * from approve_ingest_all();` (사용자 승인)

## 구형 한글(.hwp) 직접 읽기 — `hwp5.py`

- pyhwp(hwp5html) 변환이 실패하는 최신 한글 파일이 많아 OLE·레코드를 직접 읽음 (셀 주소로 격자 맞춤)
- 배포용(암호화) 문서도 읽음: ViewText 의 배포 데이터에서 열쇠를 꺼내 AES-128 복호화 (`cryptography` 패키지)
- `dump.rows_of()`가 .hwp 를 받으면 hwp5.py 우선, 실패 시 예전 변환본(.hwp.xhtml)

## 사립 위탁 채용 — `parse_private.py`

- 공고 안의 '법인명 · 학교명 · 과목 · 인원' 표를 찾아 `raw-files/raw/private/<지역>.json` (fetch 의 save 단계)
- 학년도마다: 위탁 전용 공고(서울 등) > 시행계획 > 사전예고. 위탁 전용 공고가 있으면 그것만
- 검증: 학교명에 '학교', 인원 1~50, 과목 형식, 소계·합계·장애 유형 표 제외. 서울 2026·2027은 공고 합계(291·218명)와 일치 확인
- 제목에 '(국·사립위탁 포함)'이 있는 공립 공고는 사립 위탁으로 분류하지 않음 (충남 버그 수정)

## 시군구 경계 (`collector-geo`)

- PyPI `admdongkor`(통계청 행정구역 경계 기반, 단순화 light 판) 최신 버전의 시군구 경계 → 지역별 `raw-files/raw/geo/<지역>.json`
- 좌표는 위경도(소수 4자리), 아주 작은 섬은 생략. 매달 5일 자동 갱신
- 앱 학교 지도는 이 경계 위에 학교 점을 그리고, 확대한 뒤 손을 떼면 그 배율로 다시 그려 선명하게 보임
