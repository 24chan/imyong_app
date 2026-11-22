import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { deletePracticeReview, listPracticeReviews, PracticeReview, savePracticeReview } from '../../data/practiceUgc';
import { useAsync } from '../../data/useAsync';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { ReportSheet, Sheet } from '../community/parts';

// 실습 후기 (0026): 학교마다. 쓰기는 교대·초등교육과 인증 회원만, 화면엔 '인증 회원'만 표시(누군지 드러나지 않게)
const ITEMS = [
  ['atmosphere', '분위기'],
  ['guidance', '지도·배려'],
  ['commute', '다니기 편함'],
] as const;
type Item = (typeof ITEMS)[number][0];
const avg = (rs: PracticeReview[], k: Item) => (rs.length ? (rs.reduce((s, r) => s + r[k], 0) / rs.length).toFixed(1) : '-');

export function PracticeReviews({ school, defaultYear }: { school: string; defaultYear: number }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [reload, setReload] = useState(0);
  const list = useAsync(() => listPracticeReviews(school), [school, reload]);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<{ type: 'practice_review'; id: number } | null>(null);
  const rs = list.data ?? [];
  const rec = rs.filter((r) => r.recommend).length;

  return (
    <View style={{ gap: space.sm }}>
      <Txt style={{ fontWeight: '800' }}>실습 후기 {rs.length ? rs.length : ''}</Txt>
      {list.error && <Txt variant="sub">{list.error.message}</Txt>}
      {rs.length > 0 && (
        <Txt variant="sub">
          {ITEMS.map(([k, l]) => `${l} ${avg(rs, k)}`).join(' · ')} · 추천 {rec}/{rs.length}
        </Txt>
      )}
      {!list.loading && !list.error && rs.length === 0 && <Txt variant="sub">아직 후기가 없어요. 이 학교에서 실습했다면 첫 후기를 남겨 주세요.</Txt>}
      {rs.slice(0, 20).map((r) => (
        <View key={r.id} style={{ gap: 4, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.background }}>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            인증 회원 · {r.year}학년도 실습 · {r.recommend ? '추천해요' : '추천 안 해요'} · {ITEMS.map(([k, l]) => `${l} ${r[k]}`).join(' ')}
          </Txt>
          <Txt>{r.body}</Txt>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {r.is_mine ? (
              <Pressable
                onPress={() =>
                  Alert.alert('후기를 지울까요?', '', [
                    { text: '취소', style: 'cancel' },
                    { text: '지우기', style: 'destructive', onPress: () => deletePracticeReview(r.id).then(() => setReload((n) => n + 1)) },
                  ])
                }
                hitSlop={8}
              >
                <Txt variant="sub" style={{ fontSize: 12 }}>지우기</Txt>
              </Pressable>
            ) : (
              <Pressable onPress={() => (session ? setReport({ type: 'practice_review', id: r.id }) : router.push('/login'))} hitSlop={8}>
                <Txt variant="sub" style={{ fontSize: 12 }}>신고·차단</Txt>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      <PrimaryButton label="실습 후기 쓰기" variant="ghost" onPress={() => (session ? setOpen(true) : router.push('/login'))} />
      <WriteSheet visible={open} onClose={() => setOpen(false)} school={school} defaultYear={defaultYear} onSaved={() => setReload((n) => n + 1)} />
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={() => setReload((n) => n + 1)} />
    </View>
  );
}

function WriteSheet({ visible, onClose, school, defaultYear, onSaved }: { visible: boolean; onClose: () => void; school: string; defaultYear: number; onSaved: () => void }) {
  const { colors } = useTheme();
  const now = new Date().getFullYear();
  const [year, setYear] = useState(defaultYear);
  const [score, setScore] = useState<Record<Item, number>>({ atmosphere: 0, guidance: 0, commute: 0 });
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = ITEMS.every(([k]) => score[k] > 0) && recommend !== null && body.trim().length >= 10;
  return (
    <Sheet visible={visible} onClose={onClose} title={`실습 후기 · ${school.split('|')[1]}`}>
      <Txt variant="sub" style={{ fontSize: 12 }}>
        교사·학생·직원 이름이나 누군지 알 수 있는 내용은 쓰지 말아 주세요. 사실과 다른 험담은 명예훼손이 될 수 있어요. 신고가 3번 쌓이면 바로 가려져요.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[now, now - 1, now - 2, now - 3].map((y) => (
          <Chip key={y} label={`${y}학년도`} selected={year === y} onPress={() => setYear(y)} />
        ))}
      </View>
      {ITEMS.map(([k, l]) => (
        <View key={k} style={{ gap: 4 }}>
          <Txt variant="sub">{l}</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} label={String(n)} selected={score[k] === n} onPress={() => setScore((s) => ({ ...s, [k]: n }))} />
            ))}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Chip label="추천해요" selected={recommend === true} onPress={() => setRecommend(true)} />
        <Chip label="추천 안 해요" selected={recommend === false} onPress={() => setRecommend(false)} />
      </View>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="분위기, 지도 방식, 준비하면 좋은 것, 다니기 등 (10~500자)"
        placeholderTextColor={colors.textSub}
        multiline
        maxLength={500}
        style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, minHeight: 100, textAlignVertical: 'top' }}
      />
      <PrimaryButton
        label={busy ? '저장 중…' : '후기 저장'}
        disabled={!ok || busy}
        onPress={() => {
          setBusy(true);
          savePracticeReview({ school, year, ...score, recommend: !!recommend, body: body.trim() })
            .then(() => {
              onClose();
              setBody('');
              onSaved();
            })
            .catch((e) => Alert.alert('저장하지 못했어요', (e as Error).message))
            .finally(() => setBusy(false));
        }}
      />
      <Txt variant="sub" style={{ fontSize: 12 }}>같은 학교·학년도에 다시 쓰면 앞 후기가 바뀌어요. 화면에는 '인증 회원'으로만 보여요.</Txt>
    </Sheet>
  );
}
