// 약관·개인정보처리방침·계정 삭제 안내를 웹페이지로 (GitHub Pages). 앱과 같은 원문(src/legal)을 써서 내용이 늘 같음.
// Google Play: 계정을 만들 수 있는 앱은 '웹에서 계정 삭제를 요청하는 주소'가 있어야 함 → delete.html
import { mkdirSync, writeFileSync } from 'node:fs';
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
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로그인 · ${LEGAL.appName}</title>
<style>body{font-family:-apple-system,'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F2F4F7;color:#1B2A3A}
.c{background:#fff;border-radius:20px;padding:28px 22px;max-width:360px;width:86%;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#5B6B7C;font-size:14px;line-height:1.6;margin:0 0 18px}
a.b{display:block;background:#1F5E54;color:#fff;text-decoration:none;font-weight:800;font-size:17px;padding:16px;border-radius:12px}
@media(prefers-color-scheme:dark){body{background:#0F1514;color:#E8EEED}.c{background:#18201F}a.b{background:#4FB3A0;color:#0F1514}}</style></head>
<body><div class="c"><h1 id="t">로그인됐어요</h1><p id="m">앱으로 돌아가는 중이에요. 화면이 그대로면 아래 단추를 눌러 주세요.</p><a class="b" id="go" href="#">앱으로 돌아가기</a></div>
<p id="d" style="margin-top:14px;font-size:11px;color:#93A3A1;word-break:break-all"></p>
<script>
(function(){var q=new URLSearchParams(location.search);var to=q.get('to')||'';
if(!/^(exp|exps|imyongapp):\\/\\//.test(to)){to='imyongapp://auth-callback';}
var err=q.get('error_description')||q.get('error');var h=(location.hash||'').replace(/^#/,'');
if(err){document.getElementById('t').textContent='로그인하지 못했어요';h='error_description='+encodeURIComponent(err);}
// 로그인 정보는 ? 뒤로 붙임(안드로이드 intent 주소는 # 을 따로 씀)
var url=to+(h?(to.indexOf('?')<0?'?':'&')+h:'');
var m=url.match(/^([a-z+]+):\\/\\/(.*)$/);var link=url;
if(/Android/i.test(navigator.userAgent)&&m){var pkg=m[1].indexOf('exp')===0?'host.exp.exponent':'com.imyongmongttang.app';
link='intent://'+m[2]+'#Intent;scheme='+m[1]+';package='+pkg+';end';}
document.getElementById('go').href=link;document.getElementById('d').textContent=to;
setTimeout(function(){location.href=link;},150);})();
</script></body></html>`,
);
console.log('site/ 만듦');
