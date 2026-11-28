// 약관·개인정보처리방침·계정 삭제 안내를 웹페이지로 (GitHub Pages). 앱과 같은 원문(src/legal)을 써서 내용이 늘 같음.
// Google Play: 계정을 만들 수 있는 앱은 '웹에서 계정 삭제를 요청하는 주소'가 있어야 함 → delete.html
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fill, LEGAL } from '../../src/legal/info';
import { privacySections } from '../../src/legal/privacy';
import { termsSections } from '../../src/legal/terms';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = (title: string, body: string) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${LEGAL.appName}</title>
<style>body{font-family:-apple-system,'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;max-width:760px;margin:0 auto;padding:24px 18px 60px;line-height:1.7;color:#1B2A3A}
h1{font-size:24px;color:#1F5E54}h2{font-size:17px;margin-top:28px}p{margin:6px 0}nav a{margin-right:14px;color:#1F5E54}
.box{background:#F6F8FA;border:1px solid #E3E8EE;border-radius:14px;padding:14px 16px}@media(prefers-color-scheme:dark){body{background:#0F1514;color:#E8EEED}h1,nav a{color:#4FB3A0}.box{background:#18201F;border-color:#26302F}}</style>
</head><body><nav><a href="index.html">${LEGAL.appName}</a><a href="privacy.html">개인정보처리방침</a><a href="terms.html">이용약관</a><a href="delete.html">계정 삭제</a></nav>
<h1>${esc(title)}</h1>${body}<p style="margin-top:40px;color:#5B6B7C;font-size:13px">시행일: ${esc(fill(LEGAL.effectiveDate, '시행일'))} · 버전 ${LEGAL.version}</p></body></html>`;
const sections = (list: { title: string; body: string[] }[]) =>
  list.map((s) => `<h2>${esc(s.title)}</h2>${s.body.map((b) => `<p>${esc(b)}</p>`).join('')}`).join('');

const mail = fill(LEGAL.contactEmail, '문의 메일');
mkdirSync('site', { recursive: true });
writeFileSync('site/privacy.html', page('개인정보처리방침', sections(privacySections())));
writeFileSync('site/terms.html', page('이용약관', sections(termsSections())));
writeFileSync(
  'site/delete.html',
  page(
    '계정 삭제',
    `<div class="box"><p><b>앱에서 바로 삭제:</b> 설정 → 계정 카드의 "계정 삭제". 누르면 바로 지워져요.</p>
<p><b>앱을 지웠거나 열 수 없다면:</b> 가입한 이메일 주소로 <b>${esc(mail)}</b> 에 "계정 삭제 요청"이라고 보내 주세요. 본인 확인 후 7일 안에 지우고 결과를 알려 드려요.</p></div>
<h2>함께 지워지는 것</h2><p>이메일 주소, 앱 설정(시험 구분·과목·닉네임), 인증 결과와 남은 인증 사진, 내가 쓴 글·댓글·후기·쪽지, 공감·스크랩·차단 목록, 모의고사 점수.</p>
<h2>남는 것</h2><p>법에서 보관하라고 정한 기록이 있으면 그 기간 동안만 따로 보관해요. 서버 접속 기록은 서비스 업체가 정한 기간(현재 최대 7일)이 지나면 자동으로 지워져요.</p>
<p>새 공고 알림 구독(기기 알림 주소·관심 지역)은 계정과 연결돼 있지 않아요. 앱 설정에서 알림을 끄면 바로 지워지고, 앱을 지우면 다음 발송 때 지워져요.</p>`,
  ),
);
writeFileSync(
  'site/index.html',
  page(LEGAL.appName, `<p>임용시험을 준비하는 교대생·사범대생을 위한 정보·커뮤니티 앱이에요.</p><p><a href="privacy.html">개인정보처리방침</a> · <a href="terms.html">이용약관</a> · <a href="delete.html">계정 삭제</a></p><p>문의: ${esc(mail)}</p>`),
);
// 로그인 돌아오기 페이지 (2026-11-28): 카카오·Google 로그인 뒤 브라우저가 앱(exp://, imyongapp://)을 바로 못 여는 기기가 있어
// 이 페이지를 거쳐 앱으로 넘김. 자동으로 한 번 시도하고, 안 되면 '앱으로 돌아가기' 단추(누르면 브라우저가 앱을 열어 줌)
writeFileSync(
  'site/auth.html',
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0"><title>로그인 · ${LEGAL.appName}</title>
<style>body{font-family:-apple-system,'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F2F4F7;color:#1B2A3A}
.c{background:#fff;border-radius:20px;padding:28px 22px;max-width:360px;width:86%;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#5B6B7C;font-size:14px;line-height:1.6;margin:0 0 18px}
a.b{display:block;background:#1F5E54;color:#fff;text-decoration:none;font-weight:800;font-size:17px;padding:16px;border-radius:12px}
@media(prefers-color-scheme:dark){body{background:#0F1514;color:#E8EEED}.c{background:#18201F}a.b{background:#4FB3A0;color:#0F1514}}</style></head>
<body><div class="c"><h1 id="t">로그인됐어요</h1><p id="m">로그인 정보를 앱에 보내는 중이에요…</p><p id="e" style="color:#D63B2F;font-size:13px;font-weight:700"></p><a class="b" id="go" href="#">앱으로 돌아가기</a><a id="go2" href="#" style="display:block;margin-top:14px;color:#5B6B7C;font-size:14px">안 되면 여기를 눌러 주세요</a></div>
<p id="d" style="margin-top:14px;font-size:11px;color:#93A3A1;word-break:break-all"></p>
<script>
(function(){var q=new URLSearchParams(location.search);var to=q.get('to')||'';
var raw=to;if(!/^[a-z][a-z0-9+.-]*:\\/\\//i.test(to)||/^(https?|javascript|data|file):/i.test(to)){to='imyongapp://auth-callback';}
var err=q.get('error_description')||q.get('error');var h=(location.hash||'').replace(/^#/,'');
if(err){document.getElementById('t').textContent='로그인하지 못했어요';h='error_description='+encodeURIComponent(err);}
// 로그인 정보는 ? 뒤로 붙임(안드로이드 intent 주소는 # 을 따로 씀)
var url=to+(h?(to.indexOf('?')<0?'?':'&')+h:'');
var m=url.match(/^([a-z][a-z0-9+.-]*):\\/\\/(.*)$/);var link=url;
if(/Android/i.test(navigator.userAgent)&&m){// 앱 이름(패키지)은 설치한 판마다 다를 수 있어 Expo Go 말고는 지정하지 않음
var pkg=m[1]==='exp'||m[1]==='exps'?';package=host.exp.exponent':'';
link='intent://'+m[2]+'#Intent;scheme='+m[1]+pkg+';end';}
document.getElementById('go').href=link;document.getElementById('go2').href=url;
var n=q.get('n');var M=document.getElementById('m'),E=document.getElementById('e'),D=document.getElementById('d');
// 진단 줄: 판, 돌아갈 주소, 로그인 정보 길이(h), 번호(n) 유무, 전달함 결과
var st='대기';function dbg(){D.textContent='v5 · to='+(raw||'(없음)')+' · h='+h.length+'자 · n='+(n?'있음':'없음')+' · 전달함='+st;}dbg();
function go(){location.href=link;}
if(err){M.textContent='로그인하지 못했어요: '+err;st='건너뜀(로그인 오류)';dbg();setTimeout(go,300);}
else if(!h){M.textContent='로그인 정보가 비어 있어요. 다시 로그인해 주세요.';E.textContent='주소에 #access_token 이 없어요 (Supabase가 정보를 붙이지 않음)';st='건너뜀(h 없음)';dbg();}
else if(!n){M.textContent='앱 업데이트가 덜 받아졌어요. 앱을 두 번 껐다 켠 뒤 다시 로그인해 주세요.';st='건너뜀(n 없음)';dbg();setTimeout(go,300);}
else{st='보내는 중';dbg();
// 앱 이동은 전달함 저장이 끝난 뒤에(먼저 이동하면 요청이 끊길 수 있음)
fetch('https://wckaybzamhvmhxiacmnx.supabase.co/rest/v1/rpc/put_auth_relay',{method:'POST',cache:'no-store',keepalive:true,headers:{'apikey':'sb_publishable_Fss2DpcXGiGlqSkUefgIGg_mkdmz5L6','content-type':'application/json'},body:JSON.stringify({p_nonce:n,p_payload:h})})
.then(function(r){if(r.ok){st='성공(HTTP '+r.status+')';M.textContent='로그인 정보를 앱에 보냈어요. 왼쪽 위 X를 누르면 앱으로 돌아가요.';dbg();return;}
return r.text().then(function(t){var why=/PGRST202|Could not find the function/i.test(t)?'함수 없음: 0033 SQL을 실행해 주세요':/permission denied|42501/i.test(t)?'권한 오류(실행 권한)':/42P01|does not exist/i.test(t)?'표 없음: 0033 SQL을 실행해 주세요':/bad input/i.test(t)?'번호·정보 길이 오류':'서버 오류';
st='실패(HTTP '+r.status+', '+why+')';M.textContent='앱에 로그인 정보를 보내지 못했어요.';E.textContent=why+' — '+t.slice(0,160);dbg();});})
.catch(function(x){st='실패(인터넷: '+x+')';M.textContent='앱에 로그인 정보를 보내지 못했어요.';E.textContent='인터넷 오류: '+x;dbg();})
.finally(function(){setTimeout(go,300);});}
})();
</script></body></html>`,
);
// 설치 페이지 (2026-11-28): 링크·QR 하나로 안드로이드 설치 파일 받기. 주소는 app-build-info 워크플로가 site-data/app.json 에 적음
const app = existsSync('site-data/app.json') ? (JSON.parse(readFileSync('site-data/app.json', 'utf8')) as { android?: { apk: string; version?: string; finishedAt?: string } }) : {};
const apk = app.android?.apk;
writeFileSync(
  'site/install.html',
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Cache-Control" content="no-cache"><title>설치 · ${LEGAL.appName}</title>
<style>body{font-family:-apple-system,'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;margin:0;background:#F2F4F7;color:#1B2A3A}
.w{max-width:440px;margin:0 auto;padding:36px 18px 60px}.c{background:#fff;border-radius:20px;padding:22px;margin-top:14px}
h1{font-size:26px;margin:0 0 4px;color:#1F5E54}h2{font-size:17px;margin:0 0 8px}p,li{color:#5B6B7C;font-size:14.5px;line-height:1.65;margin:4px 0}
a.b{display:block;text-align:center;background:#1F5E54;color:#fff;text-decoration:none;font-weight:800;font-size:17px;padding:16px;border-radius:12px;margin:12px 0 6px}
.off{background:#C9D1D9!important}.tag{display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:9px;background:#E1F5EE;color:#0F6E56}
@media(prefers-color-scheme:dark){body{background:#0F1514;color:#E8EEED}.c{background:#18201F;border:1px solid #26302F}h1{color:#4FB3A0}a.b{background:#4FB3A0;color:#0F1514}}</style></head>
<body><div class="w"><h1>${LEGAL.appName}</h1><p>임용 준비 교대생·사범대생을 위한 앱 · <span class="tag">비공개 시험판</span></p>
<div class="c"><h2>안드로이드</h2>${apk ? `<a class="b" href="${apk}">설치 파일 받기 (APK)</a><p>판 ${esc(app.android?.version ?? '')} · ${esc((app.android?.finishedAt ?? '').slice(0, 10))}</p>` : '<a class="b off">준비 중이에요</a>'}
<ol><li>받은 파일을 열어요.</li><li>'출처를 알 수 없는 앱' 허용을 물으면 <b>이 출처 허용</b>을 켜요.</li><li><b>설치</b>를 눌러요.</li><li>'Google Play 프로텍트 · 앱 차단됨'이 뜨면 <b>무시하고 설치하기</b>를 눌러요. 플레이 스토어에 아직 올리지 않은 시험판이라 나오는 안내예요.</li></ol><p>예전 '임용맵' 앱이 있으면 지워도 돼요.</p></div>
<div class="c"><h2>아이폰</h2><p>아이폰은 애플 정책상 TestFlight(애플 공식 시험판 앱)로만 나눠 줄 수 있어요. 준비되면 이 페이지에 초대 링크가 생겨요.</p></div>
<p style="margin-top:18px;font-size:12.5px"><a href="privacy.html">개인정보처리방침</a> · <a href="terms.html">이용약관</a></p></div></body></html>`,
);
console.log('site/ 만듦');
