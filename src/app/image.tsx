import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, useWindowDimensions, View } from 'react-native';
import { Txt } from '../components/ui';
import { useTheme } from '../theme/useTheme';

// 사진 크게 보기 (쪽지·운영자 서류 사진, 2026-11-24: 바깥 브라우저 대신 앱 안에서). 두 손가락으로 확대(iOS), 스크롤
export default function ImageScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: title ?? '사진' }} />
      <ScrollView
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Image
          source={{ uri: url }}
          style={{ width, height: height * 0.8 }}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
        />
      </ScrollView>
      {loading && !failed && <ActivityIndicator style={{ position: 'absolute', top: '45%', alignSelf: 'center' }} color={colors.brand} />}
      {failed && <Txt style={{ position: 'absolute', top: '45%', alignSelf: 'center', color: colors.textSub }}>사진을 불러오지 못했어요.</Txt>}
    </View>
  );
}
