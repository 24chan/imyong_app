import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Switch, View } from 'react-native';
import { TextInput } from '../components/TextField';
import { SubjectPicker } from '../components/pickers';
import { Card, Chip, PrimaryButton, Screen, Segmented, Txt } from '../components/ui';
import { subjectByCode } from '../data/subjects';
import { useAsync } from '../data/useAsync';
import {
  cancelVerification,
  getMyVerifications,
  getUnivs,
  METHOD_LABEL,
  setShowSubject,
  submitDocVerification,
  Univ,
  Verification,
  VerifyKind,
  VerifyMethod,
  verifySchoolEmail,
} from '../data/verify';
import { Level, useAppSettings } from '../store/AppSettings';
import { useAuth } from '../store/Auth';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const SCHOOL_METHODS: VerifyMethod[] = ['email', 'student_id', 'kakao', 'certificate'];
const TEACHER_METHODS: VerifyMethod[] = ['employment', 'license', 'contract'];
const MAX_PHOTOS = 3;

const METHOD_HINT: Partial<Record<VerifyMethod, string>> = {
  student_id: '실물 학생증 앞면 또는 학교 앱의 모바일 학생증 화면',
  kakao: '카카오톡 → 지갑 → 톡학생증 화면 캡처',
  certificate: '재학증명서 또는 졸업증명서 (정부24·학교 발급)',
  employment: '재직증명서 (학교명·직위가 보이게)',
  license: '교원자격증 (자격 종류가 보이게)',
  contract: '기간제 계약서 첫 장 (학교명이 보이게)',
};

// 학교·교사 인증: 방법을 골라 학교 메일로 바로 인증하거나 사진을 올려 운영자 확인
export default function VerifyScreen() {
  const { colors } = useTheme();
  const { session, email, signOut } = useAuth();
  const { viewLevel } = useAppSettings();
  const uid = session?.user.id ?? null;
  const [reload, setReload] = useState(0);
  const mine = useAsync(() => (uid ? getMyVerifications(uid) : Promise.resolve([])), [uid, reload]);
  const univs = useAsync(() => getUnivs(), []);

  const [kind, setKind] = useState<VerifyKind>('school');
  const [method, setMethod] = useState<VerifyMethod>('email');
  const [query, setQuery] = useState('');
  const [univ, setUniv] = useState<Univ | null>(null);
  const [univInput, setUnivInput] = useState('');
  const [notListed, setNotListed] = useState(false);
  const [teacherLevel, setTeacherLevel] = useState<Level>(viewLevel);
  const [subject, setSubject] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = (mine.data ?? []).filter((v) => v.status === 'pending');
  const approved = (mine.data ?? []).filter((v) => v.status === 'approved');
  const rejected = (mine.data ?? []).filter((v) => v.status === 'rejected').slice(0, 2);

  // 학교 목록: 초등 모드면 교대·초등교육과 먼저, 중등이면 사범대 먼저
  const univList = useMemo(() => {
    const all = univs.data ?? [];
    const q = query.trim();
    const firstKinds = viewLevel === 'elementary' ? ['edu', 'elem'] : ['sabeom', 'elem'];
    return all
      .filter((u) => !q || u.name.includes(q) || u.label.includes(q))
      .sort((a, b) => Number(!firstKinds.includes(a.kind)) - Number(!firstKinds.includes(b.kind)));
  }, [univs.data, query, viewLevel]);

  if (!uid) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '인증' }} />
        <Card>
          <Txt variant="heading">로그인이 먼저 필요해요</Txt>
          <PrimaryButton label="로그인 · 가입 (카카오·Google·이메일)" onPress={() => router.push('/login')} />
        </Card>
      </Screen>
    );
  }

  const switchKind = (k: VerifyKind) => {
    setKind(k);
    setMethod(k === 'school' ? 'email' : 'employment');
    setPhotos([]);
    setError(null);
  };

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 접근을 허용해 주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.6,
      base64: true,
    });
    if (res.canceled) return;
    const add = res.assets.filter((a) => a.base64).map((a) => ({ uri: a.uri, base64: a.base64 as string }));
    setPhotos((p) => [...p, ...add].slice(0, MAX_PHOTOS));
  };

  const doEmail = async () => {
    setBusy(true);
    setError(null);
    try {
      const label = await verifySchoolEmail();
      Alert.alert('인증됐어요', `이제 '${label}' 라벨로 글을 쓸 수 있어요.`);
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    photos.length > 0 &&
    (kind === 'teacher' || (notListed ? univInput.trim().length >= 2 : !!univ)) &&
    !(kind === 'teacher' && teacherLevel === 'secondary' && !subject);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitDocVerification(uid, {
        kind,
        method: method as Exclude<VerifyMethod, 'email'>,
        univCode: notListed ? null : univ?.code,
        univInput: notListed ? univInput : null,
        teacherLevel,
        subjectCode: subject,
        imagesBase64: photos.map((p) => p.base64),
      });
      setPhotos([]);
      Alert.alert('신청했어요', '운영자가 확인하면 라벨이 생겨요. 확인이 끝나면 사진은 바로 지워져요.');
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const methods = kind === 'school' ? SCHOOL_METHODS : TEACHER_METHODS;
  const domain = email?.split('@')[1] ?? '';
  const emailUniv = (univs.data ?? []).find((u) => u.emailDomains.some((d) => domain === d || domain.endsWith('.' + d)));

  return (
    <>
      <Stack.Screen options={{ title: '학교·교사 인증' }} />
      <Screen>
        <Txt variant="sub">
          인증하면 글·댓글·쪽지를 쓸 수 있어요. 다른 사람에게는 라벨(예: 서울교대, 중등교사)만 보여요. 재학/졸업, 기간제/정교사, 지역은
          표시하지 않아요.
        </Txt>

        {/* 내 라벨·신청 현황 */}
        {mine.loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          (approved.length > 0 || pending.length > 0 || rejected.length > 0) && (
            <Card>
              <Txt variant="heading">내 인증</Txt>
              {approved.map((v) => (
                <MyRow key={v.id} v={v} onChanged={() => setReload((n) => n + 1)} />
              ))}
              {pending.map((v) => (
                <MyRow key={v.id} v={v} onChanged={() => setReload((n) => n + 1)} />
              ))}
              {rejected.map((v) => (
                <MyRow key={v.id} v={v} onChanged={() => setReload((n) => n + 1)} />
              ))}
            </Card>
          )
        )}
        {mine.error && <Txt color="down">{mine.error.message}</Txt>}

        <Segmented<VerifyKind>
          value={kind}
          onChange={switchKind}
          options={[
            { value: 'school', label: '학교 인증' },
            { value: 'teacher', label: '교사 인증' },
          ]}
        />

        <Card>
          <Txt variant="heading">인증 방법</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {methods.map((m) => (
              <Chip
                key={m}
                label={METHOD_LABEL[m]}
                selected={method === m}
                onPress={() => {
                  setMethod(m);
                  setError(null);
                }}
              />
            ))}
          </View>
          {kind === 'school' && <Txt variant="sub">학교 메일이 없거나 사범대면 학생증·톡학생증·증명서 중 편한 걸 골라 주세요.</Txt>}
        </Card>

        {method === 'email' ? (
          <Card>
            <Txt variant="heading">학교 메일로 바로 인증</Txt>
            <Txt variant="sub">교대 메일로 로그인했다면 버튼 하나로 끝나요. 사범대는 대학 메일만으로는 학과를 알 수 없어서 사진 인증을 해 주세요.</Txt>
            <Txt>
              지금 로그인한 메일: <Txt style={{ fontWeight: '700' }}>{email}</Txt>
            </Txt>
            {emailUniv ? (
              <PrimaryButton label={`${emailUniv.label}로 인증하기`} onPress={doEmail} disabled={busy} />
            ) : (
              <>
                <Txt variant="sub" color="accent">
                  교대 메일이 아니에요. 교대 메일로 다시 로그인하거나, 다른 방법을 골라 주세요.
                </Txt>
                <PrimaryButton
                  label="교대 메일로 다시 로그인"
                  variant="ghost"
                  onPress={async () => {
                    await signOut();
                    router.replace('/login');
                  }}
                />
              </>
            )}
          </Card>
        ) : (
          <>
            {kind === 'school' ? (
              <Card>
                <Txt variant="heading">학교</Txt>
                {!notListed ? (
                  <>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="학교 이름 검색 (예: 서울교대, 한양대)"
                      placeholderTextColor={colors.textSub}
                      style={inputStyle(colors)}
                    />
                    <View style={{ maxHeight: 260 }}>
                      {univList.slice(0, 12).map((u) => (
                        <Pressable
                          key={u.code}
                          onPress={() => setUniv(u)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.line,
                          }}
                        >
                          <View>
                            <Txt style={{ fontWeight: univ?.code === u.code ? '800' : '500' }}>{u.name}</Txt>
                            <Txt variant="sub">라벨: {u.label}</Txt>
                          </View>
                          {univ?.code === u.code && <Ionicons name="checkmark-circle" size={22} color={colors.brand} />}
                        </Pressable>
                      ))}
                    </View>
                    <PrimaryButton label="목록에 없어요 (직접 입력)" variant="ghost" onPress={() => setNotListed(true)} />
                  </>
                ) : (
                  <>
                    <TextInput
                      value={univInput}
                      onChangeText={setUnivInput}
                      placeholder="학교·단과대 이름 (예: ○○대학교 사범대학)"
                      placeholderTextColor={colors.textSub}
                      style={inputStyle(colors)}
                    />
                    <Txt variant="sub">운영자가 확인하고 라벨을 정해요.</Txt>
                    <PrimaryButton label="목록에서 고르기" variant="ghost" onPress={() => setNotListed(false)} />
                  </>
                )}
              </Card>
            ) : (
              <Card>
                <Txt variant="heading">구분</Txt>
                <Segmented<Level>
                  value={teacherLevel}
                  onChange={setTeacherLevel}
                  options={[
                    { value: 'elementary', label: '초등교사' },
                    { value: 'secondary', label: '중등교사' },
                  ]}
                />
                {teacherLevel === 'secondary' && (
                  <>
                    <Txt variant="sub">과목은 기본으로 숨겨져요. 인증 후 내 인증에서 켤 수 있어요.</Txt>
                    <SubjectPicker value={subject} onChange={setSubject} />
                  </>
                )}
              </Card>
            )}

            <Card>
              <Txt variant="heading">사진 ({photos.length}/{MAX_PHOTOS})</Txt>
              <Txt variant="sub">{METHOD_HINT[method]}</Txt>
              <Txt variant="sub" color="accent">
                이름·학교·발급일만 보이면 돼요. 주민번호·학번·얼굴 사진은 가려도 돼요. 확인이 끝나면 사진은 바로 지워져요.
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {photos.map((p, i) => (
                  <View key={p.uri}>
                    <Image source={{ uri: p.uri }} style={{ width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.line }} />
                    <Pressable
                      onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                      accessibilityLabel="사진 빼기"
                      hitSlop={8}
                      style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.background, borderRadius: 12 }}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.text} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable
                    onPress={pick}
                    accessibilityRole="button"
                    accessibilityLabel="사진 추가"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: colors.textSub,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <Ionicons name="image-outline" size={26} color={colors.textSub} />
                    <Txt variant="sub">사진 추가</Txt>
                  </Pressable>
                )}
              </View>
            </Card>

            <PrimaryButton label={busy ? '올리는 중…' : '인증 신청하기'} onPress={submit} disabled={!canSubmit || busy} />
          </>
        )}

        {busy && <ActivityIndicator color={colors.brand} />}
        {error && <Txt color="down">{error}</Txt>}
      </Screen>
    </>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors']) {
  return {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  } as const;
}

function MyRow({ v, onChanged }: { v: Verification; onChanged: () => void }) {
  const { colors } = useTheme();
  const tone = v.status === 'approved' ? colors.brand : v.status === 'pending' ? colors.accent : colors.down;
  const statusText = v.status === 'approved' ? '인증됨' : v.status === 'pending' ? '확인 중' : '반려';
  const title =
    v.label ?? (v.kind === 'teacher' ? (v.teacherLevel === 'elementary' ? '초등교사' : '중등교사') : v.univInput ?? '학교 인증');
  const subj = v.kind === 'teacher' && v.teacherLevel === 'secondary' ? subjectByCode(v.subjectCode)?.name : null;
  return (
    <View style={{ gap: 4, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: tone + '22' }}>
          <Txt variant="sub" style={{ color: tone, fontWeight: '700', fontSize: 12 }}>
            {statusText}
          </Txt>
        </View>
        <Txt style={{ fontWeight: '700', flexShrink: 1 }}>
          {title}
          {subj && v.showSubject ? ` · ${subj}` : ''}
        </Txt>
        <Txt variant="sub">({METHOD_LABEL[v.method]})</Txt>
      </View>
      {v.status === 'rejected' && v.rejectReason && <Txt variant="sub">사유: {v.rejectReason}. 다시 신청할 수 있어요.</Txt>}
      {v.status === 'pending' && (
        <PrimaryButton
          label="신청 취소"
          variant="ghost"
          onPress={() => cancelVerification(v).then(onChanged).catch((e) => Alert.alert('취소하지 못했어요', (e as Error).message))}
        />
      )}
      {v.status === 'approved' && subj && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="sub">라벨에 과목({subj}) 표시</Txt>
          <Switch
            value={v.showSubject}
            onValueChange={(val) => setShowSubject(v.id, val).then(onChanged).catch((e) => Alert.alert('바꾸지 못했어요', (e as Error).message))}
            trackColor={{ true: colors.brand, false: colors.line }}
          />
        </View>
      )}
    </View>
  );
}
