import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Chip, Txt } from '../../components/ui';
import { ago } from '../../data/community';
import { regionByCode } from '../../data/regions';
import { listMockExams, listStudies, MockExam, MODE_LABEL, STAGE_LABEL, Study } from '../../data/study';
import { subjectByCode } from '../../data/subjects';
import { LabelBadge, needWriterAlert, useWriterLabels } from '../community/parts';
import { useAppSettings } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** 과목 필터 (중등): 내 과목만 / 중등 전체 */
function useSubjectFilter() {
  const { settings, viewLevel } = useAppSettings();
  const mySubject = viewLevel === 'secondary' ? settings.subjectCode : null;
  const [onlyMine, setOnlyMine] = useState(true);
  const chips = mySubject ? (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Chip label={`${subjectByCode(mySubject)?.name ?? ''}만`} selected={onlyMine} onPress={() => setOnlyMine(true)} />
      <Chip label="중등 전체" selected={!onlyMine} onPress={() => setOnlyMine(false)} />
    </View>
  ) : null;
  return { subj: onlyMine ? mySubject : null, chips };
}

/** 스터디 모집 목록 (커뮤니티 '스터디 모집' 칸) */
export function StudyBoard() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { subj, chips } = useSubjectFilter();
  const [region, setRegion] = useState<string | null>(null);
  const [stage, setStage] = useState<Study['stage'] | null>(null);
  const [mode, setMode] = useState<Study['mode'] | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [studies, setStudies] = useState<Study[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      listStudies({ level: viewLevel, subject: subj, region, stage, mode, openOnly })
        .then(setStudies)
        .catch((e) => setError((e as Error).message));
    }, [viewLevel, subj, region, stage, mode, openOnly]),
  );

  return (
    <View style={{ gap: space.md }}>
      {chips}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label="모집 중만" selected={openOnly} onPress={() => setOpenOnly((v) => !v)} />
        {(['first', 'second'] as const).map((s) => (
          <Chip key={s} label={STAGE_LABEL[s]} selected={stage === s} onPress={() => setStage(stage === s ? null : s)} />
        ))}
        {(['online', 'offline'] as const).map((m) => (
          <Chip key={m} label={MODE_LABEL[m]} selected={mode === m} onPress={() => setMode(mode === m ? null : m)} />
        ))}
        {settings.regionCodes.map((r) => (
          <Chip key={r} label={regionByCode(r)?.shortName ?? r} selected={region === r} onPress={() => setRegion(region === r ? null : r)} />
        ))}
      </ScrollView>
      {error && <Txt color="down">{error}</Txt>}
      {studies === null ? (
        <ActivityIndicator color={colors.brand} />
      ) : studies.length === 0 ? (
        <Empty icon="people-outline" text="조건에 맞는 스터디가 없어요. 직접 모집해 보세요." />
      ) : (
        studies.map((s) => <StudyCard key={s.id} s={s} />)
      )}
    </View>
  );
}

/** 모의고사: 점수 기록·비교 + 일정·후기 목록 (공부 탭) */
export function MockList() {
  const { colors } = useTheme();
  const { viewLevel } = useAppSettings();
  const { uid } = useWriterLabels();
  const { subj, chips } = useSubjectFilter();
  const [exams, setExams] = useState<MockExam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setError(null);
      listMockExams(viewLevel, subj)
        .then(setExams)
        .catch((e) => setError((e as Error).message));
    }, [viewLevel, subj]),
  );
  return (
    <View style={{ gap: space.md }}>
      {chips}
      <Pressable
        onPress={() => (uid ? router.push('/mock/scores') : needWriterAlert(null, null))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 18, borderRadius: radius.xl, backgroundColor: colors.cat.amber.bg }}
      >
        <Ionicons name="stats-chart" size={22} color={colors.cat.amber.fg} />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '800' }}>모의고사 점수 vs 실제 점수</Txt>
          <Txt variant="sub">내 기록을 남기고, 다른 수험생들의 모의·실제 점수 차이를 구간별로 봐요.</Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
      </Pressable>
      {error && <Txt color="down">{error}</Txt>}
      {exams === null ? (
        <ActivityIndicator color={colors.brand} />
      ) : exams.length === 0 ? (
        <Empty icon="calendar-outline" text="등록된 모의고사가 없어요. 운영자가 곧 올릴게요." />
      ) : (
        exams.map((e) => <ExamCard key={e.id} e={e} />)
      )}
    </View>
  );
}

function Empty({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={36} color={colors.textSub} />
      <Txt variant="sub" style={{ textAlign: 'center' }}>
        {text}
      </Txt>
    </View>
  );
}

function Tag({ text, tone }: { text: string; tone?: 'brand' | 'accent' | 'sub' }) {
  const { colors } = useTheme();
  const c = tone === 'accent' ? colors.accent : tone === 'sub' ? colors.textSub : colors.brand;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: c + '1F' }}>
      <Txt variant="sub" style={{ color: c, fontWeight: '700', fontSize: 12 }}>
        {text}
      </Txt>
    </View>
  );
}

function StudyCard({ s }: { s: Study }) {
  const { colors } = useTheme();
  const open = s.status === 'open';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/study/[id]', params: { id: String(s.id) } })}
      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: 18, gap: 8, opacity: open ? 1 : 0.6 }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Tag text={open ? '모집 중' : '마감'} tone={open ? 'accent' : 'sub'} />
        <Tag text={STAGE_LABEL[s.stage]} />
        <Tag text={MODE_LABEL[s.mode]} />
        {s.subjectCode && <Tag text={subjectByCode(s.subjectCode)?.name ?? ''} />}
        {s.regions.map((r) => (
          <Tag key={r} text={regionByCode(r)?.shortName ?? r} tone="sub" />
        ))}
        <Tag text={`${s.capacity}명`} tone="sub" />
      </View>
      <Txt style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
        {s.title}
      </Txt>
      <Txt variant="sub" color="text" numberOfLines={2} style={{ opacity: 0.8 }}>
        {s.body}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <LabelBadge label={s.label} small />
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {ago(s.createdAt)}
        </Txt>
      </View>
    </Pressable>
  );
}

function ExamCard({ e }: { e: MockExam }) {
  const { colors } = useTheme();
  const past = e.examDate ? e.examDate < new Date().toISOString().slice(0, 10) : false;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/mock/[id]', params: { id: String(e.id) } })}
      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: 18, gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Tag text={e.examDate ? (past ? '시행됨' : '예정') : '일정 미정'} tone={past ? 'sub' : 'accent'} />
        <Txt variant="sub">{e.examDate ?? ''}</Txt>
        {e.subjectCode && <Tag text={subjectByCode(e.subjectCode)?.name ?? ''} tone="sub" />}
      </View>
      <Txt style={{ fontWeight: '800', fontSize: 16 }}>{e.name}</Txt>
      <Txt variant="sub">{e.provider}</Txt>
      <Txt variant="sub">
        후기 {e.reviewCount}
        {e.ratingAvg != null ? ` · 만족 ${e.ratingAvg}/5 · 난이도 ${e.difficultyAvg}/5` : ''}
      </Txt>
    </Pressable>
  );
}
