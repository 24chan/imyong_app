import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import type { Box } from '../../data/analysis';
import { webview } from '../../lib/webview';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { cachedCrop, Crop, cropName, hasDeviceCache, pdfBase64, saveCrop } from './questionCache';

// 기출 문항 한 개만 보기 (2026-11-24 사용자 승인 A안 + 요청 3가지)
// 1) 평가원 원본 PDF·잘라낸 그림은 기기 안에 저장 → 다시 열면 바로 (questionCache.ts)
// 2) PDF 전체가 아니라 그 문항이 있는 쪽 하나만 그려서 자름 (pdf.js getPage(p) 한 번)
// 3) 자리는 쪽 대비 비율(0~1) Box 하나로 통일 — 글자 PDF·OCR·수동 입력 모두 같은 방식으로 자름
// 문항 그림은 서버·저장소에 올리지 않음. 그리기는 화면에 안 보이는 작은 웹뷰에서 pdf.js(jsDelivr)로.
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build';
const TARGET_W = 1400; // 잘라낸 그림 가로 픽셀(글자가 또렷하게)

const RENDER_HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="${PDFJS}/pdf.min.js"></script><script src="${PDFJS}/pdf.worker.min.js"></script></head><body><script>
function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))}
async function run(m){try{
  pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS}/pdf.worker.min.js';
  var bin=atob(m.b64),n=bin.length,u=new Uint8Array(n);for(var i=0;i<n;i++)u[i]=bin.charCodeAt(i);
  var doc=await pdfjsLib.getDocument({data:u}).promise;
  if(m.p<1||m.p>doc.numPages)throw new Error('쪽 번호가 없어요');
  var page=await doc.getPage(m.p);
  var v1=page.getViewport({scale:1});
  var x0=m.r[0]*v1.width,y0=m.r[1]*v1.height,cw=(m.r[2]-m.r[0])*v1.width,ch=(m.r[3]-m.r[1])*v1.height;
  var s=Math.min(4,m.w/cw);
  var vp=page.getViewport({scale:s,offsetX:-x0*s,offsetY:-y0*s});
  var c=document.createElement('canvas');c.width=Math.round(cw*s);c.height=Math.round(ch*s);
  var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:g,viewport:vp,background:'#fff'}).promise;
  post({png:c.toDataURL('image/png').split(',')[1],w:c.width,h:c.height});
  doc.destroy();
}catch(e){post({err:String(e&&e.message||e)})}}
function onMsg(e){try{run(JSON.parse(e.data))}catch(x){post({err:String(x)})}}
document.addEventListener('message',onMsg);window.addEventListener('message',onMsg);
post({ready:1});
</script></body></html>`;

type State = { k: 'wait' } | { k: 'render'; b64: string } | { k: 'done'; img: Crop } | { k: 'live' } | { k: 'err'; why: string };

export function QuestionClip({ url, box, cacheKey, title }: { url: string; box: Box; cacheKey: string; title: string }) {
  const { colors } = useTheme();
  const W = webview();
  const name = cropName(cacheKey, box, url);
  const [st, setSt] = useState<State>(() => {
    const c = cachedCrop(name);
    return c ? { k: 'done', img: c } : { k: 'wait' };
  });
  const ref = useRef<{ postMessage: (d: string) => void } | null>(null);

  useEffect(() => {
    let off = false;
    const c = cachedCrop(name);
    if (c) return setSt({ k: 'done', img: c });
    if (!W) return setSt({ k: 'err', why: 'old' });
    if (!hasDeviceCache()) return setSt({ k: 'live' }); // 옛 설치 파일: 저장 없이 바로 그리기
    setSt({ k: 'wait' });
    pdfBase64(url)
      .then((b64) => !off && setSt({ k: 'render', b64 }))
      .catch(() => !off && setSt({ k: 'err', why: 'net' }));
    return () => {
      off = true;
    };
  }, [name, url, W]);

  const frame = { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' as const, backgroundColor: '#FFFFFF' };

  if (st.k === 'done') {
    return (
      <Pressable onPress={() => router.push({ pathname: '/image', params: { url: st.img.uri, title } })} accessibilityLabel={`${title} 크게 보기`} style={frame}>
        <Image source={{ uri: st.img.uri }} style={{ width: '100%', aspectRatio: st.img.w / st.img.h }} resizeMode="contain" />
      </Pressable>
    );
  }
  if (st.k === 'err') {
    return (
      <Txt variant="sub" style={{ fontSize: 12.5 }}>
        {st.why === 'old' ? '새 버전 앱에서 문항을 바로 볼 수 있어요.' : '문항을 불러오지 못했어요. 인터넷 연결을 확인하거나 원문 전체 보기로 확인해 주세요.'}
      </Txt>
    );
  }
  if (st.k === 'live' && W) return <LiveClip url={url} box={box} />;

  return (
    <View style={[frame, { height: 150, alignItems: 'center', justifyContent: 'center', gap: space.xs }]}>
      <ActivityIndicator color={colors.brand} />
      <Txt variant="sub" style={{ fontSize: 12 }}>
        {st.k === 'wait' ? '평가원 원문을 받는 중… (한 번 받으면 다음부터 바로 떠요)' : '문항 부분만 잘라내는 중…'}
      </Txt>
      {st.k === 'render' && W && (
        <W.WebView
          ref={(r: unknown) => {
            ref.current = r as { postMessage: (d: string) => void } | null;
          }}
          source={{ html: RENDER_HTML, baseUrl: 'https://cdn.jsdelivr.net/' }}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={async (e) => {
            try {
              const m = JSON.parse(e.nativeEvent.data) as { ready?: number; png?: string; w?: number; h?: number; err?: string };
              if (m.ready) ref.current?.postMessage(JSON.stringify({ b64: st.b64, p: box.p, r: box.r, w: TARGET_W }));
              else if (m.png && m.w && m.h) {
                const saved = await saveCrop(name, m.png, m.w, m.h);
                setSt(saved ? { k: 'done', img: saved } : { k: 'done', img: { uri: `data:image/png;base64,${m.png}`, w: m.w, h: m.h } });
              } else if (m.err) setSt({ k: 'err', why: 'render' });
            } catch {
              setSt({ k: 'err', why: 'render' });
            }
          }}
          onShouldStartLoadWithRequest={(r) => r.url.startsWith('https://cdn.jsdelivr.net/') || r.url === 'about:blank'}
          style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01 }}
        />
      )}
    </View>
  );
}

/** 옛 설치 파일(파일 모듈 없음): 저장 없이 웹뷰에서 평가원 원본을 바로 받아 그 쪽 하나만 그려 보여 줌 */
function LiveClip({ url, box }: { url: string; box: Box }) {
  const { colors } = useTheme();
  const W = webview()!;
  const [h, setH] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  const html = useMemo(() => {
    const [x0, y0, x1, y1] = box.r;
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#fff}canvas{display:block;width:100%}</style>
<script src="${PDFJS}/pdf.min.js"></script><script src="${PDFJS}/pdf.worker.min.js"></script></head>
<body><canvas id="c"></canvas><script>
function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))}
(async function(){try{
  pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS}/pdf.worker.min.js';
  var doc=await pdfjsLib.getDocument({url:${JSON.stringify(url)}}).promise;
  var page=await doc.getPage(${box.p});
  var v1=page.getViewport({scale:1});
  var cssW=document.body.clientWidth||window.innerWidth, dpr=Math.min(window.devicePixelRatio||1,3);
  var cw=${x1 - x0}*v1.width, ch=${y1 - y0}*v1.height, s=cssW*dpr/cw;
  var vp=page.getViewport({scale:s,offsetX:-${x0}*v1.width*s,offsetY:-${y0}*v1.height*s});
  var c=document.getElementById('c'); c.width=Math.round(cw*s); c.height=Math.round(ch*s); c.style.height=(cssW*ch/cw)+'px';
  await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
  post({h:Math.ceil(cssW*ch/cw)});
}catch(e){post({err:String(e&&e.message||e)})}})();
</script></body></html>`;
  }, [url, box]);
  if (err) return <Txt variant="sub" style={{ fontSize: 12.5 }}>문항을 불러오지 못했어요. 원문 전체 보기로 확인해 주세요.</Txt>;
  return (
    <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
      <W.WebView
        source={{ html, baseUrl: 'https://www.kice.re.kr/' }}
        originWhitelist={['*']}
        scrollEnabled={false}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data) as { h?: number; err?: string };
            if (m.h) setH(m.h);
            if (m.err) setErr(true);
          } catch {
            /* 무시 */
          }
        }}
        onShouldStartLoadWithRequest={(r) => r.url.startsWith('https://www.kice.re.kr/') || r.url === 'about:blank'}
        style={{ height: h ?? 150, backgroundColor: '#FFFFFF' }}
      />
      {h === null && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </View>
  );
}
