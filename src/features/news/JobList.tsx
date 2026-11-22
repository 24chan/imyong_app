import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { Chip, PrimaryButton, Txt } from '../../components/ui';
import { isOpen, submitJobTip, TeacherJob } from '../../data/jobs';
import { REGIONS, regionByCode } from '../../data/regions';
import { Level, useToday } from '../../store/AppSettings';
import { toggleSavedJob, useSavedJobs } from '../../store/savedJobs';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Sheet } from '../community/parts';
import { router } from 'expo-router';

const dday = (deadline: string | null, today: string) => {
  if (!deadline) return null;
  const d = Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000);
  return d < 0 ? '마감' : d === 0 ? '오늘 마감' : `D-${d}`;
};

/** 학교별 정교사 채용 공고 묶음 (테두리 카드 하나) */
export function JobBoard({ jobs, title, footer }: { jobs: TeacherJob[]; title: string; footer?: React.ReactNode }) {
  const { colors } = useTheme();
  const today = useToday();
  const savedUrls = new Set(useSavedJobs().map((j) => j.url));
  return (
    <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, paddingBottom: space.sm }}>
        <Ionicons name="briefcase-outline" size={18} color={colors.accent} />
        <Txt variant="heading" style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      {jobs.map((j, i) => {
        const open = isOpen(j, today);
        const dd = dday(j.deadline, today);
        return (
          <Pressable
            key={j.id}
            onPress={() => Linking.openURL(j.url)}
            accessibilityRole="link"
            accessibilityHint="공고 원문이 열려요"
            style={({ pressed }) => ({
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              gap: 4,
              opacity: open ? 1 : 0.55,
              backgroundColor: pressed ? colors.surface : 'transparent',
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.line,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.accent + '22' }}>
                <Txt variant="sub" style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>
                  {j.tip ? '제보' : '학교별 채용'}
                </Txt>
              </View>
              {j.region && <Txt variant="sub" style={{ fontWeight: '700' }}>{regionByCode(j.region)?.shortName}</Txt>}
              <Txt variant="sub" style={{ fontSize: 12 }}>
                {j.posted.slice(5).replace('-', '.')}
              </Txt>
              <View style={{ flex: 1 }} />
              {dd && (
                <Txt variant="sub" style={{ fontSize: 12, fontWeight: '800' }} color={open ? 'brand' : 'textSub'}>
                  {dd}
                </Txt>
              )}
              <Pressable
                onPress={() => toggleSavedJob(j)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={savedUrls.has(j.url) ? '저장 취소' : '공고 저장'}
              >
                <Ionicons
                  name={savedUrls.has(j.url) ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={savedUrls.has(j.url) ? colors.accent : colors.textSub}
                />
              </Pressable>
            </View>
            <Txt style={{ fontWeight: '700' }} numberOfLines={2}>
              {j.title}
            </Txt>
            <Txt variant="sub" numberOfLines={1}>
              {j.org}
            </Txt>
          </Pressable>
        );
      })}
      {footer}
    </View>
  );
}

/** 공고 제보 (로그인 필요, 운영자 확인 후 보임) */
export function JobTipButton({ level }: { level: Level }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = /^https?:\/\/\S+\.\S+/.test(url.trim()) && title.trim().length >= 4;
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text };
  return (
    <>
      <PrimaryButton label="놓친 채용 공고 제보하기" variant="ghost" onPress={() => (session ? setOpen(true) : router.push('/login'))} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="채용 공고 제보">
        <Txt variant="sub">학교·법인 홈페이지나 교육청에 올라온 공고 주소를 알려 주세요. 운영자가 확인한 뒤 모두에게 보여요.</Txt>
        <TextInput value={url} onChangeText={setUrl} placeholder="공고 주소 (https://...)" placeholderTextColor={colors.textSub} autoCapitalize="none" keyboardType="url" style={input} />
        <TextInput value={title} onChangeText={setTitle} placeholder="예: 2027학년도 ○○학원 신규교사 채용(국어 2)" placeholderTextColor={colors.textSub} style={input} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REGIONS.map((r) => (
            <Chip key={r.code} label={r.shortName} selected={region === r.code} onPress={() => setRegion(region === r.code ? null : r.code)} />
          ))}
        </View>
        <PrimaryButton
          label={busy ? '보내는 중…' : '제보 보내기'}
          disabled={!ok || busy}
          onPress={() => {
            setBusy(true);
            submitJobTip({ url: url.trim(), title: title.trim(), region, level, note: '' })
              .then(() => {
                setOpen(false);
                setUrl('');
                setTitle('');
                Alert.alert('고마워요!', '운영자가 확인한 뒤 임용 소식에 올라가요.');
              })
              .catch((e) => Alert.alert('보내지 못했어요', (e as Error).message))
              .finally(() => setBusy(false));
          }}
        />
      </Sheet>
    </>
  );
}

// B-7 (2026-11-22 조사): 나라일터에는 서울·경기 밖 사립 정규채용이 거의 안 올라옴(400일 동안 전국 29건).
// 다른 지역은 ① 교육청 사립 위탁 선발(앱 '사립 위탁' 칸) ② 나이스 온라인 채용 ③ 학교 누리집에 올라와서, 바로 가는 길을 보여 줌.
const MORE_LINKS: { label: string; desc: string; url: string }[] = [
  { label: '나이스 온라인 교직원 채용', desc: '여러 교육청 학교가 함께 쓰는 채용 시스템 (지역 골라 보기)', url: 'https://edurecruit.go.kr/' },
  { label: '울산 통합인력풀', desc: '울산교육청 학교 채용공고', url: 'https://use.go.kr/job/index.do' },
  { label: '전북 시험·채용·구직', desc: '전북교육청 채용 메뉴', url: 'https://www.jbe.go.kr/index.jbe?menuCd=DOM_000000103004000000' },
  { label: '제주 채용정보', desc: '제주교육청 채용 안내', url: 'https://www.jje.go.kr/index.jje?menuCd=DOM_000000103003010000' },
];

export function MoreJobLinks() {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View style={{ padding: space.md, gap: 2 }}>
        <Txt style={{ fontWeight: '800' }}>다른 지역 사립 채용 더 찾아보기</Txt>
        <Txt variant="sub">서울·경기 밖 사립 학교는 교육청 위탁 선발('사립 위탁' 칸)이나 아래 채용 시스템에 주로 올려요.</Txt>
      </View>
      {MORE_LINKS.map((l) => (
        <Pressable
          key={l.url}
          onPress={() => Linking.openURL(l.url)}
          accessibilityRole="link"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: pressed ? colors.surface : 'transparent' })}
        >
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '700' }}>{l.label}</Txt>
            <Txt variant="sub">{l.desc}</Txt>
          </View>
          <Ionicons name="open-outline" size={17} color={colors.textSub} />
        </Pressable>
      ))}
    </View>
  );
}
