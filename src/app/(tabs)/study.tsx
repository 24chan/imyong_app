import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ViewModeBanner } from '../../components/ModeToggle';
import { Chip, Screen, Segmented, Txt } from '../../components/ui';
import { ago } from '../../data/community';
import { regionByCode } from '../../data/regions';
import {
  AREA_LABEL,
  listMaterials,
  listMockExams,
  listStudies,
  Material,
  MockExam,
  MODE_LABEL,
  STAGE_LABEL,
  Study,
} from '../../data/study';
import { subjectByCode } from '../../data/subjects';
import { LabelBadge, needWriterAlert, useWriterLabels } from '../../features/community/parts';
import { useAppSettings } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

type Tab = 'study' | 'material' | 'mock';

// 스터디·자료 탭: 스터디 모집 / 공부 자료(직접 쓴 글만) / 모의고사(일정·후기·점수 비교)
export default function StudyScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { uid, labels } = useWriterLabels();
  const mySubject = viewLevel === 'secondary' ? settings.subjectCode : null;
  const [tab, setTab] = useState<Tab>('study');

  // 스터디 필터
  const [region, setRegion] = useState<string | null>(null);
  const [stage, setStage] = useState<Study['stage'] | null>(null);
  const [mode, setMode] = useState<Study['mode'] | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [onlyMySubject, setOnlyMySubject] = useState(true);
  // 자료 필터
  const [area, setArea] = useState<Material['area'] | null>(null);
  const [sort, setSort] = useState<'new' | 'like'>('new');

  const [studies, setStudies] = useState<Study[] | null>(null);
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [exams, setExams] = useState<MockExam[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subj = onlyMySubject ? mySubject : null;
  useFocusEffect(
    useCallback(() => {
      setError(null);
      const fail = (e: unknown) => setError((e as Error).message);
      if (tab === 'study') listStudies({ level: viewLevel, subject: subj, region, stage, mode, openOnly }).then(setStudies).catch(fail);
      if (tab === 'material') listMaterials({ level: viewLevel, subject: subj, area, sort }).then(setMaterials).catch(fail);
      if (tab === 'mock') listMockExams(viewLevel, subj).then(setExams).catch(fail);
    }, [tab, viewLevel, subj, region, stage, mode, openOnly, area, sort]),
  );

  const write = () => {
    if (needWriterAlert(uid, labels)) return;
    router.push(tab === 'study' ? '/study/new' : '/materials/write');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen>
        <ViewModeBanner />
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'study', label: '스터디 모집' },
            { value: 'material', label: '공부 자료' },
            { value: 'mock', label: '모의고사' },
          ]}
        />
        {mySubject && (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip label={`${subjectByCode(mySubject)?.name ?? ''}만`} selected={onlyMySubject} onPress={() => setOnlyMySubject(true)} />
            <Chip label="중등 전체" selected={!onlyMySubject} onPress={() => setOnlyMySubject(false)} />
          </View>
        )}
        {error && <Txt color="down">{error}</Txt>}

        {tab === 'study' && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
            </View>
            {studies === null ? (
              <ActivityIndicator color={colors.brand} />
            ) : studies.length === 0 ? (
              <Empty icon="people-outline" text="조건에 맞는 스터디가 없어요. 직접 모집해 보세요." />
            ) : (
              studies.map((s) => <StudyCard key={s.id} s={s} />)
            )}
          </>
        )}

        {tab === 'material' && (
          <>
            <Txt variant="sub">직접 정리한 요약·노트만 올라와요. 교재·강의 PDF나 파일 링크 공유는 금지예요.</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="최신순" selected={sort === 'new'} onPress={() => setSort('new')} />
              <Chip label="공감순" selected={sort === 'like'} onPress={() => setSort('like')} />
              {(Object.keys(AREA_LABEL) as Material['area'][]).map((a) => (
                <Chip key={a} label={AREA_LABEL[a]} selected={area === a} onPress={() => setArea(area === a ? null : a)} />
              ))}
            </View>
            {materials === null ? (
              <ActivityIndicator color={colors.brand} />
            ) : materials.length === 0 ? (
              <Empty icon="document-text-outline" text="아직 자료가 없어요. 직접 정리한 내용을 나눠 주세요." />
            ) : (
              materials.map((m) => <MaterialCard key={m.id} m={m} />)
            )}
          </>
        )}

        {tab === 'mock' && (
          <>
            <Pressable
              onPress={() => (uid ? router.push('/mock/scores') : needWriterAlert(null, null))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent + '66', backgroundColor: colors.accent + '14' }}
            >
              <Ionicons name="stats-chart" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '800' }}>모의고사 점수 vs 실제 점수</Txt>
                <Txt variant="sub">내 기록을 남기고, 다른 수험생들의 모의·실제 점수 차이를 구간별로 봐요.</Txt>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
            </Pressable>
            {exams === null ? (
              <ActivityIndicator color={colors.brand} />
            ) : exams.length === 0 ? (
              <Empty icon="calendar-outline" text="등록된 모의고사 일정이 없어요. 운영자가 곧 올릴게요." />
            ) : (
              exams.map((e) => <ExamCard key={e.id} e={e} />)
            )}
          </>
        )}
      </Screen>
      {tab !== 'mock' && (
        <Pressable
          onPress={write}
          accessibilityRole="button"
          style={{
            position: 'absolute',
            right: space.lg,
            bottom: space.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 18,
            paddingVertical: 13,
            borderRadius: radius.pill,
            backgroundColor: colors.brand,
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Ionicons name={tab === 'study' ? 'people' : 'create-outline'} size={18} color={colors.background} />
          <Txt style={{ fontWeight: '800' }} color="background">
            {tab === 'study' ? '스터디 모집' : '자료 올리기'}
          </Txt>
        </Pressable>
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
      style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, gap: 6, opacity: open ? 1 : 0.6 }}
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

function MaterialCard({ m }: { m: Material }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/materials/[id]', params: { id: String(m.id) } })}
      style={{ borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space.md, gap: 4 }}
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text={AREA_LABEL[m.area]} />
        {m.subjectCode && <Tag text={subjectByCode(m.subjectCode)?.name ?? ''} tone="sub" />}
      </View>
      <Txt style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
        {m.title}
      </Txt>
      <Txt variant="sub" color="text" numberOfLines={2} style={{ opacity: 0.8 }}>
        {m.body}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <LabelBadge label={m.label} small />
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {ago(m.createdAt)}
        </Txt>
        <View style={{ flex: 1 }} />
        <Ionicons name={m.liked ? 'heart' : 'heart-outline'} size={14} color={colors.down} />
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {m.likeCount}
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
      style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, gap: 4 }}
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
