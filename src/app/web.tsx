import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { PrimaryButton, Txt } from '../components/ui';
import { OFFICIAL_HOSTS, webview } from '../lib/webview';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// 공식 기관 페이지를 앱 안에서 보기 (법령·교육과정·교과서 등). 위에 '브라우저로 열기' 링크.
// 공식 사이트(go.kr 등) 밖으로 나가는 링크는 바깥 브라우저로 넘김.
export default function WebScreen() {
  const { colors } = useTheme();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const W = webview();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: title ?? '자료 보기' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Txt variant="sub" style={{ flex: 1 }} numberOfLines={1}>
          출처: {host}
        </Txt>
        <Pressable
          onPress={() => Linking.openURL(url)}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line }}
        >
          <Ionicons name="open-outline" size={15} color={colors.text} />
          <Txt style={{ fontSize: 13.5, fontWeight: '700' }}>브라우저로 열기</Txt>
        </Pressable>
      </View>
      {!W || failed ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Txt variant="sub">{!W ? '이 설치 파일에서는 앱 안 보기를 쓸 수 없어요. 새 버전을 설치하면 바로 볼 수 있어요.' : '페이지를 불러오지 못했어요.'}</Txt>
          <PrimaryButton label="브라우저로 열기" onPress={() => Linking.openURL(url)} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <W.WebView
            source={{ uri: url }}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onShouldStartLoadWithRequest={(r) => {
              if (OFFICIAL_HOSTS.test(r.url) || r.url.startsWith('about:')) return true;
              Linking.openURL(r.url).catch(() => {});
              return false;
            }}
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
    </View>
  );
}
