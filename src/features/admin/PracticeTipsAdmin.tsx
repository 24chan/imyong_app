import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Card, PrimaryButton, Txt } from '../../components/ui';
import { finishPracticeTip, listPracticeTips, PracticeTip, tipFileUrls } from '../../data/practiceUgc';
import { useAsync } from '../../data/useAsync';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 운영자: 실습학교 목록 제보 (첨부 사진·PDF 보기 → supabase/data/practice/*_src.json에 학교 이름만 옮김 → 처리하면 첨부 삭제)
export function PracticeTipsAdmin() {
  const { colors } = useTheme();
  const [reload, setReload] = useState(0);
  const tips = useAsync(() => listPracticeTips(), [reload]);
  const open = (t: PracticeTip, i: number) =>
    tipFileUrls([t.file_paths[i]])
      .then(([u]) => {
        if (u) Linking.openURL(u);
      })
      .catch((e) => Alert.alert('열지 못했어요', (e as Error).message));
  const finish = (t: PracticeTip, done: boolean) =>
    finishPracticeTip(t.id, done)
      .then(() => setReload((n) => n + 1))
      .catch((e) => Alert.alert('처리하지 못했어요', (e as Error).message));
  return (
    <>
      {tips.error && <Txt color="down">{tips.error.message}</Txt>}
      {!tips.loading && !tips.error && (tips.data ?? []).length === 0 && <Txt variant="sub">검토할 사진·PDF 제보가 없어요.</Txt>}
      {(tips.data ?? []).map((t) => (
        <Card key={t.id} style={{ borderWidth: 1, borderColor: colors.line, gap: space.sm }}>
          <Txt variant="sub">
            {t.topic === 'event' ? '[일정] ' : '[실습학교] '}
            {t.topic === 'event' ? '' : t.univ}
            {t.year ? ` · ${t.year}학년도` : ''} · {t.created_at.slice(0, 10)}
          </Txt>
          {t.note && <Txt>{t.note}</Txt>}
          {t.url && (
            <Txt color="brand" onPress={() => Linking.openURL(t.url!)} numberOfLines={1}>
              {t.url}
            </Txt>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {t.file_paths.map((p, i) => (
              <PrimaryButton key={p} label={`첨부 ${i + 1}${p.endsWith('.pdf') ? ' (PDF)' : ''}`} variant="ghost" onPress={() => open(t, i)} />
            ))}
          </View>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            {t.topic === 'event'
              ? "날짜·장소·안내 주소만 '강의' 탭의 학원 일정 입력으로 옮겨 주세요(광고 문구 X). 처리하면 첨부가 바로 지워져요."
              : '학교 이름·학년·학기만 옮겨 주세요(학생 이름 X). 처리하면 첨부가 바로 지워져요.'}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="목록에 반영함" onPress={() => finish(t, true)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="거절" variant="ghost" onPress={() => finish(t, false)} />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}
