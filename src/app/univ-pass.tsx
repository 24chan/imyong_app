import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, View } from 'react-native';
import { ViewModeBanner } from '../components/ModeToggle';
import { Card, Chip, PrimaryButton, Screen, Txt } from '../components/ui';
import { subjectByCode } from '../data/subjects';
import { CertCount, listCertCounts, listPassStats, myPassCerts, MyCert, PassStat, requestPassCert } from '../data/univPass';
import { getUnivs, Univ } from '../data/verify';
import { useAppSettings } from '../store/AppSettings';
import { useAuth } from '../store/Auth';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const THIS_YEAR = new Date().getFullYear() + (new Date().getMonth() < 3 ? 0 : 1); // 1~3월은 그해 학년도 최종 발표, 4월부터는 다음 학년도

// 대학별 합격률: 초등 = 교대·초등교육과, 중등 = 사범대(과목별). 출처·기준일·표본 수 함께
export default function UnivPassScreen() {
  const { colors } = useTheme();
  const { settings, viewLevel } = useAppSettings();
  const { session } = useAuth();
  const subject = viewLevel === 'secondary' ? settings.subjectCode : null;
  const [stats, setStats] = useState<PassStat[] | null>(null);
  const [certs, setCerts] = useState<CertCount[]>([]);
  const [univs, setUnivs] = useState<Univ[]>([]);
  const [mine, setMine] = useState<MyCert[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [subjOnly, setSubjOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listPassStats(viewLevel).then(setStats).catch((e) => setError((e as Error).message));
      listCertCounts(viewLevel).then(setCerts);
      getUnivs().then(setUnivs).catch(() => {});
      if (session) myPassCerts().then(setMine);
    }, [viewLevel, session]),
  );

  const label = (code: string) => univs.find((u) => u.code === code)?.label ?? code;
  const years = useMemo(() => [...new Set([...(stats ?? []).map((s) => s.year), ...certs.map((c) => c.year)])].sort((a, b) => b - a), [stats, certs]);
  const y = year ?? years[0] ?? null;
  const rows = useMemo(() => {
    const list = (stats ?? []).filter((s) => s.year === y && (!subject || !subjOnly || !s.subjectCode || s.subjectCode === subject));
    return list
      .map((s) => ({ ...s, rate: s.graduates ? s.passed / s.graduates : s.applicants ? s.passed / s.applicants : null }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [stats, y, subject, subjOnly]);
  const certRows = certs.filter((c) => c.year === y && !rows.some((r) => r.univCode === c.univCode));

  const certify = async () => {
    if (!session) return router.push('/login');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('사진 접근 권한이 필요해요');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    setBusy(true);
    try {
      await requestPassCert(session.user.id, THIS_YEAR, viewLevel, subject, res.assets[0].base64);
      Alert.alert('신청했어요', '운영자가 확인하면 대학별 합격 인증 수에 더해져요. 사진은 확인 즉시 지워져요.');
      myPassCerts().then(setMine);
    } catch (e) {
      Alert.alert('신청하지 못했어요', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const myThis = mine.find((m) => m.year === THIS_YEAR && m.level === viewLevel);

  return (
    <Screen>
      <Stack.Screen options={{ title: '대학별 합격률' }} />
      <ViewModeBanner />
      <Txt variant="sub">
        {viewLevel === 'elementary' ? '교대·초등교육과' : `사범대${subject ? ` (${subjectByCode(subject)?.name})` : ''}`} 기준이에요. 공식 자료는 정보공개청구 회신 등 원문 출처와 기준일을 함께 보여줘요. 대학 홍보 기사는 쓰지 않아요.
      </Txt>
      {years.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {years.map((yy) => (
            <Chip key={yy} label={`${yy}학년도`} selected={yy === y} onPress={() => setYear(yy)} />
          ))}
        </View>
      )}
      {subject && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label={`${subjectByCode(subject)?.name} 우선`} selected={subjOnly} onPress={() => setSubjOnly(true)} />
          <Chip label="전체 과목" selected={!subjOnly} onPress={() => setSubjOnly(false)} />
        </View>
      )}
      {error && <Txt color="down">{error}</Txt>}

      {stats === null ? (
        <ActivityIndicator color={colors.brand} />
      ) : rows.length === 0 && certRows.length === 0 ? (
        <Card>
          <Txt variant="heading">아직 공개할 자료가 없어요</Txt>
          <Txt variant="sub">교육청·대학에 정보공개청구한 자료가 오면 출처와 함께 올라와요. 합격자라면 아래에서 합격 인증을 해 주세요.</Txt>
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {rows.map((r, i) => (
            <View key={r.id} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Txt style={{ width: 22, fontWeight: '800', color: i < 3 ? colors.accent : colors.textSub }}>{i + 1}</Txt>
                <Txt style={{ flex: 1, fontWeight: '800' }}>
                  {label(r.univCode)}
                  {r.subjectCode ? ` · ${subjectByCode(r.subjectCode)?.name}` : ''}
                </Txt>
                <Txt variant="number" style={{ fontSize: 20 }}>
                  {r.rate != null ? `${(r.rate * 100).toFixed(1)}%` : '-'}
                </Txt>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line, marginLeft: 30 }}>
                <View style={{ width: `${Math.min(100, (r.rate ?? 0) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.brand }} />
              </View>
              <Txt variant="sub" style={{ marginLeft: 30 }}>
                합격 {r.passed}명 / {r.graduates ?? r.applicants ?? '-'}명 ({r.basis})
                {certs.find((c) => c.univCode === r.univCode && c.year === r.year) ? ` · 이용자 합격 인증 ${certs.find((c) => c.univCode === r.univCode && c.year === r.year)?.certified}명` : ''}
              </Txt>
              <Pressable disabled={!r.sourceUrl} onPress={() => r.sourceUrl && Linking.openURL(r.sourceUrl)} style={{ marginLeft: 30 }}>
                <Txt variant="sub" style={{ fontSize: 12, textDecorationLine: r.sourceUrl ? 'underline' : 'none' }}>
                  출처: {r.sourceTitle} · {r.sourceDate} 기준
                </Txt>
              </Pressable>
            </View>
          ))}
          {certRows.map((c) => (
            <View key={c.univCode} style={{ paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', gap: space.sm }}>
              <Txt style={{ flex: 1, fontWeight: '700' }}>{label(c.univCode)}</Txt>
              <Txt variant="sub">공식 자료 없음 · 이용자 합격 인증 {c.certified}명</Txt>
            </View>
          ))}
        </Card>
      )}
      <Txt variant="sub">이용자 합격 인증 수는 앱에서 인증한 사람만 센 표본이라 실제 합격자 수와 달라요. 3명 미만인 대학은 숨겨요.</Txt>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name="ribbon-outline" size={22} color={colors.brand} />
          <Txt variant="heading">{THIS_YEAR}학년도 합격자라면</Txt>
        </View>
        <Txt variant="sub">최종 합격 화면을 올려 주시면 출신 대학(학교 인증 기준)의 합격 인증 수에 더해져요. 이름·수험번호는 가려도 돼요.</Txt>
        {myThis ? (
          <Txt style={{ fontWeight: '700' }}>{myThis.status === 'approved' ? '합격 인증됨 🎉' : myThis.status === 'pending' ? '확인 중이에요' : '반려됐어요. 다시 올려 주세요.'}</Txt>
        ) : null}
        {(!myThis || myThis.status === 'rejected') && <PrimaryButton label={busy ? '올리는 중…' : '합격 인증하기'} onPress={certify} disabled={busy} />}
      </Card>
      <View style={{ height: radius.md }} />
    </Screen>
  );
}
