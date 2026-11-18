import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, View } from 'react-native';
import { PrimaryButton, Screen, Txt } from '../components/ui';
import { regionByCode } from '../data/regions';
import { getNotices } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { NOTICE_LABEL } from '../features/news/NoticeList';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { Level } from '../store/AppSettings';

/** 그림 한 장: 화면 폭에 맞추고 원래 비율 유지 */
function PageImage({ uri, index }: { uri: string; index: number }) {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    Image.getSize(uri, (w, h) => setRatio(w / h), () => setFailed(true));
  }, [uri]);
  if (failed) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }}>
      {ratio ? (
        <Image source={{ uri }} style={{ width: '100%', aspectRatio: ratio }} resizeMode="contain" accessibilityLabel={`공고문 ${index + 1}쪽`} />
      ) : (
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </View>
  );
}

// 임용 소식 상세: 공고문 그림을 앱 안에서 바로 보고, 아래에 원문·첨부 링크
export default function NoticeScreen() {
  const { colors } = useTheme();
  const { url, level } = useLocalSearchParams<{ url: string; level: Level }>();
  const notices = useAsync(() => getNotices(level ?? 'elementary', 300), [level]);
  const item = (notices.data ?? []).find((x) => x.url === url);

  if (notices.loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
  if (!item) {
    return (
      <Screen>
        <Txt>공고를 찾지 못했어요.</Txt>
        {url ? <PrimaryButton label="원문 열기" onPress={() => Linking.openURL(url)} /> : null}
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: `${regionByCode(item.region)?.shortName ?? ''} ${NOTICE_LABEL[item.docType]}` }} />
      <Txt variant="sub">
        {regionByCode(item.region)?.name} · {item.year}학년도{item.postedAt ? ` · 등록 ${item.postedAt}` : ''}
      </Txt>
      <Txt style={{ fontSize: 18, fontWeight: '800', lineHeight: 26 }}>{item.title}</Txt>

      {item.images.length > 0 ? (
        <View style={{ gap: space.md }}>
          {item.images.map((u, i) => (
            <PageImage key={u} uri={u} index={i} />
          ))}
          <Txt variant="sub">첨부 PDF 앞쪽만 보여줘요. 전체 내용과 한글·엑셀 파일은 아래 원문에서 확인하세요.</Txt>
        </View>
      ) : (
        <Txt variant="sub">이 공고는 바로 볼 수 있는 그림이 없어요 (한글·엑셀 첨부). 아래 원문에서 확인하세요.</Txt>
      )}

      <PrimaryButton label="교육청 원문 공고 열기" onPress={() => Linking.openURL(item.url).catch(() => {})} />
      {item.files.length > 0 && (
        <View style={{ gap: space.xs }}>
          <Txt variant="heading">첨부 파일</Txt>
          {item.files.map((f) => (
            <Pressable
              key={f.url}
              onPress={() => Linking.openURL(f.url).catch(() => {})}
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}
            >
              <Ionicons name="document-attach-outline" size={18} color={colors.brand} />
              <Txt style={{ flex: 1 }} numberOfLines={2}>
                {f.name}
              </Txt>
              <Ionicons name="open-outline" size={15} color={colors.textSub} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
