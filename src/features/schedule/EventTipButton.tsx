import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { AcademyEvent, EVENT_KIND, submitEventTip } from '../../data/academy';
import { subjectByCode } from '../../data/subjects';
import { Level, useAppSettings } from '../../store/AppSettings';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Sheet } from '../community/parts';

type K = AcademyEvent['kind'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 일정 제보 (C-1, 0024): 설명회·개강·인강 오픈 등을 알려 주면 운영자 확인 후 일정 탭에 보여요 */
export function EventTipButton({ level, label = '놓친 일정 제보하기' }: { level: Level; label?: string }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { settings } = useAppSettings();
  const mySubject = level === 'secondary' ? settings.subjectCode : null;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<K>('briefing');
  const [title, setTitle] = useState('');
  const [academy, setAcademy] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [place, setPlace] = useState('');
  const [url, setUrl] = useState('');
  const [forMine, setForMine] = useState(false);
  const [busy, setBusy] = useState(false);

  const urlOk = !url.trim() || /^https?:\/\/\S+\.\S+/.test(url.trim());
  const endsOk = !ends.trim() || (DATE.test(ends.trim()) && ends.trim() >= starts.trim());
  const ok = title.trim().length >= 4 && DATE.test(starts.trim()) && endsOk && urlOk;
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text };
  const reset = () => {
    setTitle('');
    setAcademy('');
    setStarts('');
    setEnds('');
    setPlace('');
    setUrl('');
    setForMine(false);
  };

  return (
    <>
      <PrimaryButton label={label} variant="ghost" onPress={() => (session ? setOpen(true) : router.push('/login'))} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="일정 제보">
        <Txt variant="sub">학원 설명회·개강·특강·모의고사·인강 오픈 일정을 알려 주세요. 운영자가 확인한 뒤 모두에게 보여요. 홍보 문구는 빼고 사실만 적어 주세요.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(EVENT_KIND) as K[]).map((k) => (
            <Chip key={k} label={EVENT_KIND[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="예: 2028 대비 교육학 설명회" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={academy} onChangeText={setAcademy} placeholder="학원·인강 이름 (선택)" placeholderTextColor={colors.textSub} style={input} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput value={starts} onChangeText={setStarts} placeholder="날짜 2026-12-05" placeholderTextColor={colors.textSub} keyboardType="numbers-and-punctuation" style={[input, { flex: 1 }]} />
          <TextInput value={ends} onChangeText={setEnds} placeholder="끝나는 날 (선택)" placeholderTextColor={colors.textSub} keyboardType="numbers-and-punctuation" style={[input, { flex: 1 }]} />
        </View>
        <TextInput value={place} onChangeText={setPlace} placeholder="장소 또는 '온라인' (선택)" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={url} onChangeText={setUrl} placeholder="안내 주소 https://... (선택)" placeholderTextColor={colors.textSub} autoCapitalize="none" keyboardType="url" style={input} />
        {mySubject && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="교육학·공통" selected={!forMine} onPress={() => setForMine(false)} />
            <Chip label={`${subjectByCode(mySubject)?.name ?? '내 과목'} 전공`} selected={forMine} onPress={() => setForMine(true)} />
          </View>
        )}
        {!endsOk && <Txt color="down">끝나는 날은 시작 날짜와 같거나 뒤여야 해요.</Txt>}
        {!urlOk && <Txt color="down">주소는 https:// 로 시작해야 해요.</Txt>}
        <PrimaryButton
          label={busy ? '보내는 중…' : '제보 보내기'}
          disabled={!ok || busy}
          onPress={() => {
            setBusy(true);
            submitEventTip({
              kind,
              title: title.trim(),
              academy: academy.trim(),
              starts: starts.trim(),
              ends: ends.trim() || null,
              level,
              subject: forMine ? mySubject : null,
              place: place.trim(),
              url: url.trim(),
            })
              .then(() => {
                setOpen(false);
                reset();
                Alert.alert('고마워요!', '운영자가 확인한 뒤 일정 탭에 올라가요.');
              })
              .catch((e) => Alert.alert('보내지 못했어요', (e as Error).message))
              .finally(() => setBusy(false));
          }}
        />
      </Sheet>
    </>
  );
}
