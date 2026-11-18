# 자동 수집기 (GitHub Actions)

교육청 임용 게시판 → 공고·첨부(HWP/HWPX/PDF) → 숫자 추출 → Supabase `ingest_queue`(검수 대기) → 운영자 승인 → 본 테이블

## 진행
- [x] 0단계 접속 확인 `collector-probe` (2026-11-18): 14/17
- [x] 1단계 준비 게시판 링크 구조 조사 `collector-survey` (2026-11-18)
- [ ] 1단계 지역별 목록 → 상세 → 첨부 URL 수집 (임용 관련 2024~2027 공고만)
- [ ] 2단계 첨부 다운로드 + 문서 종류 분류 (시행계획 / 접수현황 / 1차 응시 / 1차 합격 / 최종 합격)
- [ ] 3단계 표 추출 (hwpx: XML, pdf: 텍스트, hwp(구형): pyhwp/hwp5txt) + 자체 검증(일반+장애+지역=총원, 교육부 합계)
- [ ] 4단계 ingest_queue 저장 (GitHub Secret `SUPABASE_SECRET_KEY` 필요, 사용자가 등록)
- [ ] 5단계 하루 1회 자동 실행(cron), 시즌엔 더 자주 / 새 공고 알림

## 게시판 조사 결과 (2026-11-18)
| 지역 | 게시판 | 상세 링크 방식 | 상태 |
|---|---|---|---|
| 서울 | sen.go.kr BD_selectBbsList.do?q_bbsSn=1094 | href 직접 (q_bbsDocNo) | OK |
| 부산 | pen.go.kr selectNttList.do?mi=30361&bbsId=2342 | data-id=nttSn → selectNttInfo.do | OK (상세 URL 패턴 확인 필요) |
| 대구 | dge.go.kr | 메인이 SSO로 리다이렉트 | 게시판 주소 찾아야 함 |
| 인천 | ice.go.kr selectNttList.do?mi=10991&bbsId=1777 | 해외 접속 시 /law/main.do 로 리다이렉트 | 다른 경로 필요 |
| 광주 | gen.go.kr xboard tbnum=49 | href 직접 | OK |
| 대전 | dje.go.kr boardID=64 (임용시험) | href 직접 | OK |
| 울산 | use.go.kr | 인증서 체인 불완전(검증 완화 시 접속), 메인에 링크 없음 | 게시판 주소 찾아야 함 |
| 세종 | sje.go.kr | 시간 초과 | 해외 차단 의심 |
| 경기 | goe.go.kr selectNttList.do?mi=10154&bbsId=2583 | data-id=nttSn | OK |
| 강원 | gwe.go.kr list.do?key=bTIzMDcyMTA1ODIyNTA= | onclick goView('id') | 상세 URL 패턴 확인 필요 |
| 충북 | cbe.go.kr | JS 리다이렉트 /cbe/index.do | 게시판 주소 찾아야 함 |
| 충남 | cne.go.kr | 짧은 시작 페이지 | 게시판 주소 찾아야 함 |
| 전북 | jbe.go.kr board/view.jbe (BBS_0000043) | href 직접 | OK |
| 전남 | jne.go.kr | 시간 초과 | 해외 차단 의심 |
| 경북 | gbe.kr selectNttList.do?mi=3538&bbsId=1882 | data-id=nttSn | OK |
| 경남 | gne.go.kr BD_selectBbsList.do?q_bbsSn=1251 | href 직접 | OK |
| 제주 | jje.go.kr board/view.jje (BBS_0000002) | href 직접 | OK |

## 해외 차단 대안 (세종·전남·인천 등)
- 국내 IP가 필요한 곳은 (a) 사용자가 공고 파일을 직접 올리기, (b) 국내 클라우드 무료 실행 환경, (c) 컴퓨터 세션 때 자체 실행기(self-hosted runner) 중 선택
