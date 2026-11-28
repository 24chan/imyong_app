import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Txt } from '../../components/ui';
import { webview } from '../../lib/webview';
import { useTheme } from '../../theme/useTheme';
import { Crop, cropBase64 } from './questionCache';

// 기출 문항 필기 (2026-11-28 사용자 요청)
// 문항 그림 위에 손가락·펜으로 쓰기: 펜(색 4·굵기 3), 형광펜(색 3), 지우개(선 통째로), 되돌리기, 모두 지우기,
// 두 손가락으로 확대·축소·이동, 손 도구(한 손가락 이동), 맞춤. 필기는 이 기기에만 저장(note:v1:<문항>), 쓸 때마다 자동 저장
// 선 좌표는 그림 대비 비율(0~1)이라 화면을 돌리거나 배치가 바뀌어도 제자리에 남음
const KEY = (k: string) => `note:v1:${k}`;
export type Stroke = { i: number; t: 'pen' | 'hl'; c: string; w: number; p: number[][] };

export function NoteCanvas({ noteKey, imgs, layout }: { noteKey: string; imgs: Crop[]; layout: 'row' | 'col' }) {
  const { colors } = useTheme();
  const W = webview();
  const [b64, setB64] = useState<(string | null)[] | null>(null);
  const [strokes, setStrokes] = useState<Stroke[] | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let off = false;
    Promise.all(imgs.map((m) => cropBase64(m.uri))).then((r) => !off && setB64(r));
    AsyncStorage.getItem(KEY(noteKey))
      .then((raw) => !off && setStrokes(raw ? (JSON.parse(raw) as Stroke[]) : []))
      .catch(() => !off && setStrokes([]));
    return () => {
      off = true;
    };
  }, [imgs, noteKey]);

  const html = useMemo(() => {
    if (!b64 || !strokes || b64.some((x) => !x)) return null;
    const pages = imgs.map((m, i) => ({ src: `data:image/png;base64,${b64[i]}`, w: m.w, h: m.h }));
    const theme = {
      bg: colors.canvas,
      bar: colors.background,
      line: colors.line,
      text: colors.text,
      sub: colors.textSub,
      brand: colors.brand,
      pens: [colors.text, colors.down, colors.cat.blue.fg, colors.up],
      hls: [colors.cat.amber.fg, colors.cat.teal.fg, colors.cat.coral.fg],
    };
    return buildHtml(pages, strokes, layout, theme);
    // 처음 한 번만 만듦(필기 중에 다시 만들면 화면이 처음으로 돌아감)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b64, strokes === null, layout]);

  if (!W) return <Txt variant="sub">새 버전 앱에서 필기할 수 있어요.</Txt>;
  if (b64 && b64.some((x) => !x)) return <Txt variant="sub">문항 그림을 불러오지 못했어요. 다시 열어 주세요.</Txt>;
  if (!html) return <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />;

  return (
    <View style={{ flex: 1 }}>
      <W.WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        style={{ flex: 1, backgroundColor: colors.canvas }}
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data) as { save?: Stroke[] };
            if (!m.save) return;
            const data = m.save;
            setSaved('saving');
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              AsyncStorage.setItem(KEY(noteKey), JSON.stringify(data))
                .then(() => setSaved('saved'))
                .catch(() => setSaved('idle'));
            }, 400);
          } catch {
            /* 무시 */
          }
        }}
      />
      <Txt variant="sub" style={{ position: 'absolute', right: 12, bottom: 8, fontSize: 11.5 }}>
        {saved === 'saving' ? '저장 중…' : saved === 'saved' ? '필기 저장됨 · 이 기기에만' : '필기는 이 기기에만 저장돼요'}
      </Txt>
    </View>
  );
}

type Theme = { bg: string; bar: string; line: string; text: string; sub: string; brand: string; pens: string[]; hls: string[] };

export function buildHtml(pages: { src: string; w: number; h: number }[], strokes: Stroke[], layout: 'row' | 'col', t: Theme) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;overflow:hidden;background:${t.bg};font-family:-apple-system,system-ui,sans-serif;touch-action:none}
#bar{position:fixed;left:0;right:0;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;background:${t.bar};border-bottom:1px solid ${t.line}}
.b{min-width:36px;height:36px;padding:0 10px;border-radius:18px;border:1px solid ${t.line};background:${t.bar};color:${t.text};font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center}
.b.on{background:${t.text};color:${t.bar};border-color:${t.text}}
.dot{width:26px;height:26px;border-radius:13px;border:2px solid ${t.bar};box-shadow:0 0 0 1px ${t.line}}
.dot.on{box-shadow:0 0 0 3px ${t.text}}
.sep{width:1px;height:26px;background:${t.line};margin:0 2px}
.w{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:18px;border:1px solid ${t.line}}
.w.on{border:2px solid ${t.text}}
.w i{display:block;background:${t.text};border-radius:4px;width:18px}
#view{position:absolute;left:0;right:0;bottom:0;overflow:hidden}
#stage{position:absolute;left:0;top:0;transform-origin:0 0;display:flex;gap:16px;padding:16px;flex-direction:${layout === 'row' ? 'row' : 'column'};align-items:flex-start}
.page{position:relative;background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.12);overflow:hidden}
.page img,.page canvas{position:absolute;left:0;top:0;width:100%;height:100%}
</style></head><body>
<div id="bar"></div>
<div id="view"><div id="stage"></div></div>
<script>
var PAGES=${JSON.stringify(pages)}, STROKES=${JSON.stringify(strokes)}, PENS=${JSON.stringify(t.pens)}, HLS=${JSON.stringify(t.hls)};
var tool='pen', pen=PENS[0], hl=HLS[0], wIdx=1, WID=[0.0025,0.0045,0.008], HLW=0.022;
var scale=1, tx=0, ty=0, undo=[];
var bar=document.getElementById('bar'), view=document.getElementById('view'), stage=document.getElementById('stage');
var BASE=1000; // 그림 한 장의 기본 너비(화면 배치용)
var els=PAGES.map(function(p,i){
  var d=document.createElement('div');d.className='page';
  var h=BASE*p.h/p.w; d.style.width=BASE+'px'; d.style.height=h+'px';
  var im=document.createElement('img'); im.src=p.src; d.appendChild(im);
  var c=document.createElement('canvas'); c.width=p.w; c.height=p.h; d.appendChild(c);
  stage.appendChild(d); return {d:d,c:c,g:c.getContext('2d'),p:p};
});
function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))}
function save(){post({save:STROKES})}
function draw(i){
  var e=els[i],g=e.g,W=e.c.width,H=e.c.height; g.clearRect(0,0,W,H);
  STROKES.forEach(function(s){ if(s.i!==i||!s.p.length) return;
    g.save(); g.globalAlpha=s.t==='hl'?0.35:1; g.strokeStyle=s.c; g.lineWidth=s.w*W; g.lineCap=s.t==='hl'?'butt':'round'; g.lineJoin='round';
    g.beginPath(); g.moveTo(s.p[0][0]*W,s.p[0][1]*H);
    if(s.p.length===1) g.lineTo(s.p[0][0]*W+0.1,s.p[0][1]*H);
    for(var k=1;k<s.p.length;k++) g.lineTo(s.p[k][0]*W,s.p[k][1]*H);
    g.stroke(); g.restore(); });
}
function drawAll(){for(var i=0;i<els.length;i++) draw(i)}
function apply(){stage.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')'}
function fit(){
  var vw=view.clientWidth, vh=view.clientHeight, sw=stage.scrollWidth, sh=stage.scrollHeight;
  scale=Math.min(vw/sw, ${layout === 'row' ? 'vh/sh' : '99'}); if(!isFinite(scale)||scale<=0) scale=1;
  tx=Math.max(0,(vw-sw*scale)/2); ty=0; apply();
}
function zoomAt(f,cx,cy){var s=Math.max(0.3,Math.min(6,scale*f)); tx=cx-(cx-tx)*(s/scale); ty=cy-(cy-ty)*(s/scale); scale=s; apply()}
function btn(label,on,fn,cls){var b=document.createElement('div'); b.className=(cls||'b')+(on?' on':''); if(label!==null) b.innerHTML=label; b.onclick=fn; bar.appendChild(b); return b}
function sep(){var s=document.createElement('div');s.className='sep';bar.appendChild(s)}
function render(){
  bar.innerHTML='';
  btn('✋ 이동',tool==='hand',function(){tool='hand';render()});
  btn('✏️ 펜',tool==='pen',function(){tool='pen';render()});
  btn('🖍 형광펜',tool==='hl',function(){tool='hl';render()});
  btn('⌫ 지우개',tool==='erase',function(){tool='erase';render()});
  sep();
  if(tool==='pen'){
    PENS.forEach(function(c){var d=btn('',pen===c,function(){pen=c;render()},'dot'); d.style.background=c});
    sep();
    [3,6,10].forEach(function(px,k){var d=btn('',wIdx===k,function(){wIdx=k;render()},'w'); d.innerHTML='<i style="height:'+px+'px"></i>'});
    sep();
  } else if(tool==='hl'){
    HLS.forEach(function(c){var d=btn('',hl===c,function(){hl=c;render()},'dot'); d.style.background=c; d.style.opacity=.6});
    sep();
  }
  btn('↶',false,function(){var u=undo.pop(); if(u){STROKES=u; drawAll(); save()}});
  btn('모두 지우기',false,function(){if(!STROKES.length) return; undo.push(STROKES.slice()); STROKES=[]; drawAll(); save()});
  sep();
  btn('－',false,function(){zoomAt(1/1.25,view.clientWidth/2,view.clientHeight/2)});
  btn('＋',false,function(){zoomAt(1.25,view.clientWidth/2,view.clientHeight/2)});
  btn('맞춤',false,fit);
  view.style.top=bar.offsetHeight+'px';
}
function hitPage(x,y){
  for(var i=0;i<els.length;i++){var r=els[i].d.getBoundingClientRect(); if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return {i:i,r:r}}
  return null;
}
function local(i,x,y){var r=els[i].d.getBoundingClientRect(); return [Math.max(0,Math.min(1,(x-r.left)/r.width)),Math.max(0,Math.min(1,(y-r.top)/r.height))]}
function eraseAt(x,y){
  var h=hitPage(x,y); if(!h) return false; var pt=local(h.i,x,y), rad=18/h.r.width, ar=h.r.height/h.r.width, before=STROKES.length;
  STROKES=STROKES.filter(function(s){ if(s.i!==h.i) return true;
    for(var k=0;k<s.p.length;k++){var dx=s.p[k][0]-pt[0], dy=(s.p[k][1]-pt[1])*ar; if(dx*dx+dy*dy<rad*rad) return false} return true});
  if(STROKES.length!==before){draw(h.i); return true} return false;
}
var mode=null, cur=null, last=null, pinch=null, erased=false;
function dist(a,b){var dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy)}
view.addEventListener('touchstart',function(e){
  e.preventDefault();
  if(e.touches.length>=2){ if(cur){STROKES.pop(); draw(cur.i); undo.pop(); cur=null}
    var a=e.touches[0],b=e.touches[1]; pinch={d:dist(a,b),s:scale,mx:(a.clientX+b.clientX)/2,my:(a.clientY+b.clientY)/2,tx:tx,ty:ty}; mode='pinch'; return }
  var t=e.touches[0], x=t.clientX, y=t.clientY;
  if(tool==='hand'){mode='pan'; last=[x,y]; return}
  if(tool==='erase'){mode='erase'; undo.push(STROKES.slice()); erased=eraseAt(x,y); return}
  var h=hitPage(x,y); if(!h){mode='pan'; last=[x,y]; return}
  undo.push(STROKES.slice());
  cur={i:h.i,t:tool==='hl'?'hl':'pen',c:tool==='hl'?hl:pen,w:tool==='hl'?HLW:WID[wIdx],p:[local(h.i,x,y)]};
  STROKES.push(cur); mode='draw'; draw(h.i);
},{passive:false});
view.addEventListener('touchmove',function(e){
  e.preventDefault();
  if(mode==='pinch'&&e.touches.length>=2){var a=e.touches[0],b=e.touches[1];
    var s=Math.max(0.3,Math.min(6,pinch.s*dist(a,b)/pinch.d)), mx=(a.clientX+b.clientX)/2, my=(a.clientY+b.clientY)/2;
    tx=mx-(pinch.mx-pinch.tx)*(s/pinch.s); ty=my-(pinch.my-pinch.ty)*(s/pinch.s); scale=s; apply(); return}
  var t=e.touches[0], x=t.clientX, y=t.clientY;
  if(mode==='pan'){tx+=x-last[0]; ty+=y-last[1]; last=[x,y]; apply(); return}
  if(mode==='erase'){ if(eraseAt(x,y)) erased=true; return}
  if(mode==='draw'&&cur){cur.p.push(local(cur.i,x,y)); draw(cur.i)}
},{passive:false});
view.addEventListener('touchend',function(e){
  e.preventDefault();
  if(e.touches.length) { if(mode==='pinch'&&e.touches.length===1){mode='pan'; last=[e.touches[0].clientX,e.touches[0].clientY]} return }
  if(mode==='draw'&&cur){ cur.p=cur.p.map(function(q){return [Math.round(q[0]*10000)/10000,Math.round(q[1]*10000)/10000]}); save() }
  if(mode==='erase'){ if(erased) save(); else undo.pop() }
  mode=null; cur=null; erased=false;
},{passive:false});
render(); drawAll();
var loaded=0; els.forEach(function(e){ if(e.d.firstChild.complete) loaded++; else e.d.firstChild.onload=function(){ if(++loaded===els.length) fit() } });
setTimeout(fit,60); window.addEventListener('resize',function(){render(); fit()});
</script></body></html>`;
}
