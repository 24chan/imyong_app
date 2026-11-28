import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Txt } from '../../components/ui';
import { radius, space } from '../../theme/tokens';

// 카카오·Google 로그인 단추 (2026-11-28 사용자 요청: 다른 앱처럼 색을 넣어서)
// 색은 SPEC 토큰이 아니라 각 회사의 로그인 단추 가이드 색 — 바꾸면 심사·브랜드 규정 위반이라 고정
// 카카오: 노랑 #FEE500 + 검은 말풍선, 글자 85% 검정 / Google: 흰 바탕 + #747775 테두리 + 4색 G, 글자 #1F1F1F
const KAKAO = { bg: '#FEE500', fg: 'rgba(0,0,0,0.85)' };
const GOOGLE = { bg: '#FFFFFF', line: '#747775', fg: '#1F1F1F' };

function KakaoMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#000000" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.27 4.67 6.67-.2.76-.74 2.75-.85 3.18-.13.53.2.52.41.38.17-.11 2.67-1.82 3.75-2.55.66.1 1.33.15 2.02.15 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
    </Svg>
  );
}

function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function SocialButtons({ onPress, disabled, dim }: { onPress: (p: 'kakao' | 'google') => void; disabled?: boolean; dim?: boolean }) {
  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        onPress={() => onPress('kakao')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="카카오로 시작하기"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: radius.md, backgroundColor: KAKAO.bg, opacity: dim ? 0.45 : pressed ? 0.85 : 1 })}
      >
        <KakaoMark />
        <Txt style={{ fontWeight: '700', fontSize: 16, color: KAKAO.fg }}>카카오로 시작하기</Txt>
      </Pressable>
      <Pressable
        onPress={() => onPress('google')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Google로 시작하기"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: GOOGLE.line, backgroundColor: pressed ? '#F2F2F2' : GOOGLE.bg, opacity: dim ? 0.45 : 1 })}
      >
        <GoogleMark />
        <Txt style={{ fontWeight: '600', fontSize: 16, color: GOOGLE.fg }}>Google로 시작하기</Txt>
      </Pressable>
    </View>
  );
}
