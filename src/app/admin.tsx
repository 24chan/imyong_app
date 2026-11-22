import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, View } from 'react-native';
import { TextInput } from '../components/TextField';
import { Card, Chip, PrimaryButton, Screen, Segmented, Txt } from '../components/ui';
import { adminAppeal, adminAppeals, adminReports, adminResolve, ReportGroup, Sanction, SANCTION_LABEL } from '../data/community';
import { subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import { getPendingVerifications, getUnivs, METHOD_LABEL, reviewVerification, signedDocUrls, Verification } from '../data/verify';
import { useAuth } from '../store/Auth';
import { SubjectPicker } from '../components/pickers';
import { adminAddMockExam, adminDeleteMockExam, listMockExams } from '../data/study';
import { adminAddEvent, adminAddLecture, adminDelete, adminEnrollments, adminLectureRequests, adminReviewEnrollment, Area, enrollDocUrls, EVENT_KIND, EventTip, LECTURE_AREA, listPendingEventTips, PendingEnrollment, reviewEventTip } from '../data/academy';
import type { Level } from '../store/AppSettings';
import { JobTip, listPendingTips, reviewJobTip } from '../data/jobs';
import { regionByCode } from '../data/regions';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const REASONS = ['사진이 흐려요', '학교·학과 확인이 안 돼요', '서류 종류가 달라요', '이름·발급일이 안 보여요'];

// 운영자 메뉴: 인증 검수 (승인·거절하면 사진은 바로 삭제)
export default function AdminScreen() {
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<'verify' | 'reports' | 'appeals' | 'mock' | 'academy' | 'jobs'>('verify');
  const list = useAsync(() => (isAdmin ? getPendingVerifications() : Promise.resolve([])), [isAdmin, reload]);
  const reports = useAsync(() => (isAdmin ? adminReports() : Promise.resolve([])), [isAdmin, reload]);
  const appeals = useAsync(() => (isAdmin ? adminAppeals() : Promise.resolve([])), [isAdmin, reload]);
  const univs = useAsync(() => getUnivs(), []);

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '운영자' }} />
        <Txt>운영자만 볼 수 있어요.</Txt>
      </Screen>
    );
  }

  const univName = (code: string | null) => (univs.data ?? []).find((u) => u.code === code);

  return (
    <>
      <Stack.Screen options={{ title: '운영자' }} />
      <Screen>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'verify', label: `인증 ${(list.data ?? []).length}` },
            { value: 'reports', label: `신고 ${(reports.data ?? []).length}` },
            { value: 'appeals', label: `이의 ${(appeals.data ?? []).length}` },
            { value: 'mock', label: '모의' },
            { value: 'academy', label: '강의' },
            { value: 'jobs', label: '제보' },
          ]}
        />
        <PrimaryButton label="새로고침" variant="ghost" onPress={() => setReload((n) => n + 1)} />
        {tab === 'verify' && (
          <>
            <Txt variant="sub">승인하거나 거절하면 사진은 저장소에서 바로 지워지고, 결과(라벨)만 남아요.</Txt>
            {list.loading && <ActivityIndicator color={colors.brand} />}
            {list.error && <Txt color="down">{list.error.message}</Txt>}
            {!list.loading && (list.data ?? []).length === 0 && <Txt variant="sub">확인할 신청이 없어요.</Txt>}
            {(list.data ?? []).map((v) => (
              <ReviewCard key={v.id} v={v} univ={univName(v.univCode)} onDone={() => setReload((n) => n + 1)} />
            ))}
          </>
        )}
        {tab === 'reports' && (
          <>
            <Txt variant="sub">신고가 많은 순서예요. 5명 이상 신고된 글·댓글은 이미 자동으로 가려져 있어요. 쪽지는 신고된 것만 보여요.</Txt>
            {reports.error && <Txt color="down">{reports.error.message}</Txt>}
            {!reports.loading && (reports.data ?? []).length === 0 && <Txt variant="sub">처리할 신고가 없어요.</Txt>}
            {(reports.data ?? []).map((r) => (
              <ReportCard key={`${r.targetType}-${r.targetId}`} r={r} onDone={() => setReload((n) => n + 1)} />
            ))}
          </>
        )}
        {tab === 'mock' && <MockAdmin />}
        {tab === 'academy' && <AcademyAdmin />}
        {tab === 'jobs' && (
          <>
            <Txt variant="heading">채용 공고 제보</Txt>
            <JobTipsAdmin />
            <Txt variant="heading">일정 제보</Txt>
            <EventTipsAdmin />
          </>
        )}
        {tab === 'appeals' && (
          <>
            {appeals.error && <Txt color="down">{appeals.error.message}</Txt>}
            {!appeals.loading && (appeals.data ?? []).length === 0 && <Txt variant="sub">이의 신청이 없어요.</Txt>}
            {(appeals.data ?? []).map((a) => (
              <Card key={a.id} style={{ borderWidth: 1, borderColor: colors.line }}>
                <Txt variant="heading">{SANCTION_LABEL[a.level]}</Txt>
                <Txt variant="sub">제한 사유: {a.reason}</Txt>
                <Txt>이의 내용: {a.appeal}</Txt>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton label="받아들이기 (제한 해제)" onPress={() => adminAppeal(a.id, true).then(() => setReload((n) => n + 1))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton label="유지" variant="ghost" onPress={() => adminAppeal(a.id, false).then(() => setReload((n) => n + 1))} />
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
      </Screen>
    </>
  );
}

function ReviewCard({ v, univ, onDone }: { v: Verification; univ?: { name: string; label: string }; onDone: () => void }) {
  const { colors } = useTheme();
  const [urls, setUrls] = useState<string[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    signedDocUrls(v.docPaths)
      .then(setUrls)
      .catch(() => setUrls([]));
  }, [v.docPaths]);

  const target =
    v.kind === 'teacher'
      ? `${v.teacherLevel === 'elementary' ? '초등교사' : '중등교사'}${v.subjectCode ? ` (${subjectByCode(v.subjectCode)?.name ?? v.subjectCode})` : ''}`
      : univ
        ? `${univ.name} → 라벨 '${univ.label}'`
        : `직접 입력: ${v.univInput}`;

  const act = async (approve: boolean) => {
    if (!approve && !reason) {
      Alert.alert('거절 사유를 골라 주세요');
      return;
    }
    if (approve && v.kind === 'school' && !v.univCode && label.trim().length < 2) {
      Alert.alert('라벨을 입력해 주세요', "예: ○○대 사범대");
      return;
    }
    setBusy(true);
    try {
      await reviewVerification(v, approve, { reason: reason ?? undefined, label: label.trim() || undefined });
      onDone();
    } catch (e) {
      Alert.alert('처리하지 못했어요', (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card style={{ borderWidth: 1, borderColor: colors.line }}>
      <Txt variant="heading">{v.kind === 'teacher' ? '교사 인증' : '학교 인증'} · {METHOD_LABEL[v.method]}</Txt>
      <Txt>{target}</Txt>
      <Txt variant="sub">{new Date(v.createdAt).toLocaleString('ko-KR')}</Txt>
      {urls === null ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <View style={{ gap: space.sm }}>
          {urls.map((u, i) => (
            <Pressable key={u} onPress={() => Linking.openURL(u)} accessibilityLabel={`서류 사진 ${i + 1} 크게 보기`}>
              <Image source={{ uri: u }} style={{ width: '100%', aspectRatio: 1.4, borderRadius: radius.md, backgroundColor: colors.line }} resizeMode="contain" />
            </Pressable>
          ))}
          {urls.length === 0 && <Txt variant="sub">사진을 불러오지 못했어요.</Txt>}
        </View>
      )}
      {v.kind === 'school' && !v.univCode && (
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="라벨 (예: ○○대 사범대)"
          placeholderTextColor={colors.textSub}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background }}
        />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
        ))}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="승인" onPress={() => act(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="거절" variant="ghost" onPress={() => act(false)} />
          </View>
        </View>
      )}
    </Card>
  );
}

const TYPE_LABEL = { post: '글', comment: '댓글', message: '쪽지', study: '스터디', material: '자료', mock_review: '모의고사 후기', lecture_review: '강의 후기' } as const;

function ReportCard({ r, onDone }: { r: ReportGroup; onDone: () => void }) {
  const { colors } = useTheme();
  const [sanction, setSanction] = useState<Sanction['level'] | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (action: 'keep' | 'hide' | 'delete', hideDays?: number) => {
    setBusy(true);
    try {
      await adminResolve(r.targetType, r.targetId, action, action === 'keep' ? null : sanction, r.reasons, hideDays ?? null);
      onDone();
    } catch (e) {
      Alert.alert('처리하지 못했어요', (e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Card style={{ borderWidth: 1, borderColor: r.contentStatus === 'hidden' ? colors.down : colors.line }}>
      <Txt variant="heading">
        {TYPE_LABEL[r.targetType]} · 신고 {r.reports}건{r.contentStatus === 'hidden' ? ' · 가려짐' : ''}
      </Txt>
      <Txt variant="sub">사유: {r.reasons}</Txt>
      <Txt style={{ backgroundColor: colors.background, padding: space.sm, borderRadius: radius.sm }}>{r.content ?? '(지워진 내용)'}</Txt>
      <Txt variant="sub">작성자 이전 제재 {r.authorSanctions}회</Txt>
      <Txt variant="sub">작성자 제재 (선택)</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(['warning', 'write_7d', 'write_30d', 'permanent'] as const).map((l) => (
          <Chip key={l} label={SANCTION_LABEL[l]} selected={sanction === l} onPress={() => setSanction(sanction === l ? null : l)} />
        ))}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <View style={{ gap: space.xs }}>
          <PrimaryButton label="문제없음 (다시 보이기)" variant="ghost" onPress={() => act('keep')} />
          {r.targetType === 'post' && <PrimaryButton label="임시조치 30일 가리기" variant="ghost" onPress={() => act('hide', 30)} />}
          {r.targetType !== 'message' && <PrimaryButton label="가리기" variant="ghost" onPress={() => act('hide')} />}
          <PrimaryButton label="삭제" onPress={() => act('delete')} />
        </View>
      )}
    </Card>
  );
}

function MockAdmin() {
  const { colors } = useTheme();
  const [level, setLevel] = useState<Level>('elementary');
  const [subject, setSubject] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [reload, setReload] = useState(0);
  const list = useAsync(() => listMockExams(level), [level, reload]);
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background } as const;
  const add = async () => {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('날짜는 2026-12-05 형식으로 넣어 주세요');
    try {
      await adminAddMockExam({ name, provider, level, subject: level === 'secondary' ? subject : null, date: date || null, url, note });
      setName('');
      setDate('');
      setUrl('');
      setNote('');
      setReload((n) => n + 1);
    } catch (e) {
      Alert.alert('등록하지 못했어요', (e as Error).message);
    }
  };
  return (
    <>
      <Card>
        <Txt variant="heading">모의고사 일정 등록</Txt>
        <Segmented<Level> value={level} onChange={setLevel} options={[{ value: 'elementary', label: '초등' }, { value: 'secondary', label: '중등' }]} />
        {level === 'secondary' && (
          <>
            <Txt variant="sub">과목 (안 고르면 중등 전체)</Txt>
            <SubjectPicker value={subject} onChange={(c) => setSubject(subject === c ? null : c)} />
          </>
        )}
        <TextInput value={name} onChangeText={setName} placeholder="이름 (예: 전국 모의고사 3회)" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={provider} onChangeText={setProvider} placeholder="주관 (학원·기관)" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={date} onChangeText={setDate} placeholder="날짜 2026-12-05 (모르면 비움)" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={url} onChangeText={setUrl} placeholder="안내 주소 (선택)" placeholderTextColor={colors.textSub} autoCapitalize="none" style={input} />
        <TextInput value={note} onChangeText={setNote} placeholder="메모 (선택: 응시료·방식 등, 광고 문구 금지)" placeholderTextColor={colors.textSub} style={input} />
        <PrimaryButton label="등록" onPress={add} disabled={!name.trim() || !provider.trim()} />
      </Card>
      {(list.data ?? []).map((e) => (
        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Txt style={{ flex: 1 }}>
            {e.examDate ?? '미정'} · {e.name} ({e.provider})
          </Txt>
          <Pressable
            onPress={() =>
              Alert.alert('삭제할까요?', '후기도 함께 지워져요.', [
                { text: '취소', style: 'cancel' },
                { text: '삭제', style: 'destructive', onPress: () => adminDeleteMockExam(e.id).then(() => setReload((n) => n + 1)) },
              ])
            }
          >
            <Txt color="down">삭제</Txt>
          </Pressable>
        </View>
      ))}
    </>
  );
}

function EnrollCard({ e, onDone }: { e: PendingEnrollment; onDone: () => void }) {
  const { colors } = useTheme();
  const [urls, setUrls] = useState<string[] | null>(null);
  useEffect(() => {
    enrollDocUrls(e.docPaths).then(setUrls).catch(() => setUrls([]));
  }, [e.docPaths]);
  const act = (ok: boolean) => adminReviewEnrollment(e, ok, ok ? undefined : '강의 이름 확인이 어려워요').then(onDone).catch((x) => Alert.alert('처리하지 못했어요', (x as Error).message));
  return (
    <Card style={{ borderWidth: 1, borderColor: colors.line }}>
      <Txt variant="heading">수강 인증 · {e.academyName}</Txt>
      <Txt>
        {e.instructor} · {e.lectureTitle}
      </Txt>
      {(urls ?? []).map((u) => (
        <Pressable key={u} onPress={() => Linking.openURL(u)}>
          <Image source={{ uri: u }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.line }} resizeMode="contain" />
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="승인" onPress={() => act(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="거절" variant="ghost" onPress={() => act(false)} />
        </View>
      </View>
    </Card>
  );
}

function AcademyAdmin() {
  const { colors } = useTheme();
  const [reload, setReload] = useState(0);
  const enrolls = useAsync(() => adminEnrollments(), [reload]);
  const reqs = useAsync(() => adminLectureRequests(), [reload]);
  const [level, setLevel] = useState<Level>('elementary');
  const [area, setArea] = useState<Area>('pedagogy');
  const [subject, setSubject] = useState<string | null>(null);
  const [academy, setAcademy] = useState('');
  const [instructor, setInstructor] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<keyof typeof EVENT_KIND>('open');
  const [evTitle, setEvTitle] = useState('');
  const [starts, setStarts] = useState('');
  const [place, setPlace] = useState('');
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background } as const;
  const done = () => setReload((n) => n + 1);
  return (
    <>
      <Txt variant="heading">수강 인증 {(enrolls.data ?? []).length}</Txt>
      {(enrolls.data ?? []).map((e) => (
        <EnrollCard key={e.id} e={e} onDone={done} />
      ))}
      {(reqs.data ?? []).length > 0 && (
        <Card>
          <Txt variant="heading">강의 추가 요청</Txt>
          {(reqs.data ?? []).map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Txt style={{ flex: 1 }}>{r.text}</Txt>
              <Pressable onPress={() => adminDelete('lecture_requests', r.id).then(done)}>
                <Txt variant="sub">처리함</Txt>
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      <Card>
        <Txt variant="heading">강의 등록 · 일정 등록 공통</Txt>
        <Segmented<Level> value={level} onChange={setLevel} options={[{ value: 'elementary', label: '초등' }, { value: 'secondary', label: '중등' }]} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(Object.keys(LECTURE_AREA) as Area[]).map((a) => (
            <Chip key={a} label={LECTURE_AREA[a]} selected={area === a} onPress={() => setArea(a)} />
          ))}
        </View>
        {level === 'secondary' && area === 'major' && <SubjectPicker value={subject} onChange={setSubject} />}
        <TextInput value={academy} onChangeText={setAcademy} placeholder="학원·인강 이름" placeholderTextColor={colors.textSub} style={input} />
      </Card>
      <Card>
        <Txt variant="heading">강의 등록</Txt>
        <TextInput value={instructor} onChangeText={setInstructor} placeholder="강사" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={title} onChangeText={setTitle} placeholder="강의명" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={url} onChangeText={setUrl} placeholder="안내 주소 (선택)" placeholderTextColor={colors.textSub} autoCapitalize="none" style={input} />
        <PrimaryButton
          label="강의 등록"
          disabled={!academy.trim() || !instructor.trim() || !title.trim()}
          onPress={() =>
            adminAddLecture({ academy, instructor, title, level, area, subject: level === 'secondary' && area === 'major' ? subject : null, url })
              .then(() => {
                setInstructor('');
                setTitle('');
                setUrl('');
                done();
                Alert.alert('등록했어요');
              })
              .catch((e) => Alert.alert('등록하지 못했어요', (e as Error).message))
          }
        />
      </Card>
      <Card>
        <Txt variant="heading">학원 일정 (개강·특강·설명회 등)</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(EVENT_KIND) as (keyof typeof EVENT_KIND)[]).map((k) => (
            <Chip key={k} label={EVENT_KIND[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <TextInput value={evTitle} onChangeText={setEvTitle} placeholder="제목 (예: 교육학 기본반 개강)" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={starts} onChangeText={setStarts} placeholder="날짜 2026-12-01" placeholderTextColor={colors.textSub} style={input} />
        <TextInput value={place} onChangeText={setPlace} placeholder="장소 또는 '온라인' (선택)" placeholderTextColor={colors.textSub} style={input} />
        <PrimaryButton
          label="일정 등록"
          disabled={!evTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(starts)}
          onPress={() =>
            adminAddEvent({ academy, kind, title: evTitle, starts, ends: null, level, area, subject: level === 'secondary' && area === 'major' ? subject : null, url: '', place })
              .then(() => {
                setEvTitle('');
                setPlace('');
                Alert.alert('등록했어요');
              })
              .catch((e) => Alert.alert('등록하지 못했어요', (e as Error).message))
          }
        />
      </Card>
    </>
  );
}

function JobTipsAdmin() {
  const { colors } = useTheme();
  const [reload, setReload] = useState(0);
  const tips = useAsync(() => listPendingTips(), [reload]);
  const [titles, setTitles] = useState<Record<number, string>>({});
  const act = (t: JobTip, ok: boolean) =>
    reviewJobTip(t.id, ok, titles[t.id])
      .then(() => setReload((n) => n + 1))
      .catch((e) => Alert.alert('처리하지 못했어요', (e as Error).message));
  return (
    <>
      {tips.error && <Txt color="down">{tips.error.message} (0015 SQL 실행 전이면 정상)</Txt>}
      {!tips.loading && (tips.data ?? []).length === 0 && <Txt variant="sub">검토할 제보가 없어요.</Txt>}
      {(tips.data ?? []).map((t) => (
        <Card key={t.id} style={{ borderWidth: 1, borderColor: colors.line }}>
          <Txt variant="sub">
            {t.region ? regionByCode(t.region)?.shortName : '지역 미상'} · {t.level === 'elementary' ? '초등' : t.level === 'secondary' ? '중등' : '학교급 미상'} · {t.created_at.slice(0, 10)}
          </Txt>
          <TextInput
            value={titles[t.id] ?? t.title}
            onChangeText={(v) => setTitles((m) => ({ ...m, [t.id]: v }))}
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text }}
          />
          <Txt color="brand" onPress={() => Linking.openURL(t.url)} numberOfLines={1}>
            {t.url}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="승인" onPress={() => act(t, true)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="거절" variant="ghost" onPress={() => act(t, false)} />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

function EventTipsAdmin() {
  const { colors } = useTheme();
  const [reload, setReload] = useState(0);
  const tips = useAsync(() => listPendingEventTips(), [reload]);
  const [titles, setTitles] = useState<Record<number, string>>({});
  const act = (t: EventTip, ok: boolean) =>
    reviewEventTip(t.id, ok, titles[t.id])
      .then(() => setReload((n) => n + 1))
      .catch((e) => Alert.alert('처리하지 못했어요', (e as Error).message));
  return (
    <>
      {tips.error && <Txt color="down">{tips.error.message} (0024 SQL 실행 전이면 정상)</Txt>}
      {!tips.loading && (tips.data ?? []).length === 0 && <Txt variant="sub">검토할 일정 제보가 없어요.</Txt>}
      {(tips.data ?? []).map((t) => (
        <Card key={t.id} style={{ borderWidth: 1, borderColor: colors.line }}>
          <Txt variant="sub">
            {EVENT_KIND[t.kind]} · {t.level === 'elementary' ? '초등' : '중등'}
            {t.subject_code ? ` · ${t.subject_code}` : ''} · {t.starts_on}
            {t.ends_on ? ` ~ ${t.ends_on}` : ''}
          </Txt>
          <TextInput
            value={titles[t.id] ?? t.title}
            onChangeText={(v) => setTitles((m) => ({ ...m, [t.id]: v }))}
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text }}
          />
          {(t.academy || t.place) && <Txt variant="sub">{[t.academy, t.place].filter(Boolean).join(' · ')}</Txt>}
          {t.url && (
            <Txt color="brand" onPress={() => Linking.openURL(t.url!)} numberOfLines={1}>
              {t.url}
            </Txt>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="승인" onPress={() => act(t, true)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="거절" variant="ghost" onPress={() => act(t, false)} />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}
