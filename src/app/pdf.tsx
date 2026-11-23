import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { PrimaryButton, Txt } from '../components/ui';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { OFFICIAL_HOSTS, webview } from '../lib/webview';

// PDF 미리보기: 공식 기관 파일 주소를 그대로 열어 앱 안에서 보여줌. 예외: 공고 한글 첨부·교육과정 고시문은 수집 때 PDF로 바꿔 둔 것(공문서·고시, 저작권법 제7조).
// 안드로이드는 웹뷰가 PDF를 직접 못 그려서 Google 문서 뷰어로 열고, iOS는 웹뷰가 바로 그림.

export default function PdfScreen() {
  const { colors } = useTheme();
  const { url, title, page, pageLabel } = useLocalSearchParams<{ url: string; title?: string; page?: string; pageLabel?: string }>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const W = webview();
  const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: title ?? '미리보기' }} />
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Pressable
          onPress={() => Linking.openURL(url)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.brand }}
        >
          <Ionicons name="download-outline" size={16} color={colors.background} />
          <Txt style={{ fontWeight: '800', color: colors.background }}>파일 받기</Txt>
        </Pressable>
        {!!page && (
          <Pressable
            onPress={() => Linking.openURL(page)}
            accessibilityRole="link"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line }}
          >
            <Ionicons name="open-outline" size={16} color={colors.text} />
            <Txt style={{ fontWeight: '700' }}>{pageLabel ?? '원문 페이지'}</Txt>
          </Pressable>
        )}
      </View>
      {!W || failed ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Txt variant="sub">{!W ? '이 설치 파일에서는 앱 안 미리보기를 쓸 수 없어요. 새 버전을 설치하면 바로 볼 수 있어요.' : '미리보기를 불러오지 못했어요.'}</Txt>
          <PrimaryButton label="파일 열기" onPress={() => Linking.openURL(url)} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <W.WebView
            source={{ uri: viewer }}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onShouldStartLoadWithRequest={(r) => OFFICIAL_HOSTS.test(r.url)}
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: colors.background }}
          />
          {loading && (
            <View style={{ position: 'absolute', top: space.xl, left: 0, right: 0, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          )}
        </View>
      )}
      <Txt variant="sub" style={{ padding: space.sm, textAlign: 'center', fontSize: 12 }}>
        파일은 원래 기관 서버에서 열려요 · 미리보기는 Google 문서 뷰어
      </Txt>
    </View>
  );
}
