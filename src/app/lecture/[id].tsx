import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { Card, PrimaryButton, Screen, Txt } from '../../components/ui';
import { deleteLectureReview, getLecture, Lecture, LECTURE_AREA, LectureReview, listLectureReviews, requestEnrollment, upsertLectureReview } from '../../data/academy';
import { ago } from '../../data/community';
import { subjectByCode } from '../../data/subjects';
import { LabelBadge, needWriterAlert, ReportSheet, useWriterLabels } from '../../features/community/parts';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { openLink } from '../../lib/openLink';

function Stars({ value, onChange, size = 14 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.accent} />
        </Pressable>
      ))}
    </View>
  );
}

const PARTS: { key: 'delivery' | 'material' | 'care'; label: string }[] = [
  { key: 'delivery', label: '전달력' },
  { key: 'material', label: '교재·자료' },
  { key: 'care', label: '관리·피드백' },
];

// 강의 상세: 평점(항목별), 후기, 수강 인증 → 후기 쓰기
export default function LectureScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lectureId = Number(id);
  const { uid, labels } = useWriterLabels();
  const [lec, setLec] = useState<Lecture | null | undefined>(undefined);
  const [reviews, setReviews] = useState<LectureReview[]>([]);
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [form, setForm] = useState({ rating: 0, delivery: 0, material: 0, care: 0, body: '' });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ type: 'lecture_review'; id: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([getLecture(lectureId), listLectureReviews(lectureId)]);
      setLec(l);
      setReviews(r);
      const mine = r.find((x) => x.isMine);
      if (mine) setForm({ rating: mine.rating, delivery: mine.delivery, material: mine.material, care: mine.care, body: mine.body });
    } catch {
      setLec(null);
    }
  }, [lectureId]);
  useEffect(() => {
    load();
  }, [load]);

  if (lec === undefined) return <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  if (!lec)
    return (
      <Screen>
        <Txt>강의를 찾을 수 없어요.</Txt>
      </Screen>
    );

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('사진 접근 권한이 필요해요');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsMultipleSelection: true, selectionLimit: 2 });
    if (!res.canceled) setPhotos(res.assets.filter((a) => a.base64).map((a) => ({ uri: a.uri, base64: a.base64 as string })).slice(0, 2));
  };
  const enroll = async () => {
    if (!uid) return needWriterAlert(uid, labels);
    setBusy(true);
    try {
      await requestEnrollment(uid, lectureId, photos.map((p) => p.base64));
      setPhotos([]);
      Alert.alert('신청했어요', '운영자가 확인하면 후기를 쓸 수 있어요. 확인이 끝나면 사진은 바로 지워져요.');
      load();
    } catch (e) {
      Alert.alert('신청하지 못했어요', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (needWriterAlert(uid, labels)) return;
    setBusy(true);
    try {
      await upsertLectureReview(lectureId, form);
      Alert.alert('후기를 남겼어요');
      load();
    } catch (e) {
      Alert.alert('저장하지 못했어요', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: '강의' }} />
      <Txt variant="sub">
        {lec.academyName} · {LECTURE_AREA[lec.area]}
        {lec.subjectCode ? ` ${subjectByCode(lec.subjectCode)?.name ?? ''}` : ''}
      </Txt>
      <Txt variant="title">
        {lec.instructor} · {lec.title}
      </Txt>
      {lec.url && <PrimaryButton label="강의 안내 열기" variant="ghost" onPress={() => openLink(lec.url, '강의 안내')} />}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <Txt variant="number">{lec.ratingAvg != null ? lec.ratingAvg.toFixed(1) : '-'}</Txt>
          <Stars value={Math.round(lec.ratingAvg ?? 0)} size={18} />
          <Txt variant="sub">후기 {lec.reviewCount}</Txt>
        </View>
        {PARTS.map((p) => {
          const v = p.key === 'delivery' ? lec.deliveryAvg : p.key === 'material' ? lec.materialAvg : lec.careAvg;
          return (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Txt style={{ width: 90 }}>{p.label}</Txt>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' }}>
                <View style={{ width: `${((v ?? 0) / 5) * 100}%`, height: 8, backgroundColor: colors.accent }} />
              </View>
              <Txt style={{ width: 30, textAlign: 'right', fontWeight: '700' }}>{v ?? '-'}</Txt>
            </View>
          );
        })}
      </Card>

      {/* 수강 인증 → 후기 */}
      {lec.myEnrollment === 'approved' ? (
        <Card>
          <Txt variant="heading">내 후기</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt style={{ fontWeight: '700' }}>종합</Txt>
            <Stars value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} size={26} />
          </View>
          {PARTS.map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt>{p.label}</Txt>
              <Stars value={form[p.key]} onChange={(n) => setForm({ ...form, [p.key]: n })} size={22} />
            </View>
          ))}
          <TextInput
            value={form.body}
            onChangeText={(t) => setForm({ ...form, body: t })}
            placeholder="좋았던 점, 아쉬운 점, 이런 사람에게 추천 (10자 이상)"
            placeholderTextColor={colors.textSub}
            multiline
            style={{ minHeight: 100, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background }}
          />
          <PrimaryButton label={busy ? '저장 중…' : '후기 저장'} onPress={save} disabled={busy || !form.rating || !form.delivery || !form.material || !form.care || form.body.trim().length < 10} />
        </Card>
      ) : lec.myEnrollment === 'pending' ? (
        <Card>
          <Txt variant="heading">수강 인증 확인 중이에요</Txt>
          <Txt variant="sub">운영자가 확인하면 후기를 쓸 수 있어요.</Txt>
        </Card>
      ) : (
        <Card>
          <Txt variant="heading">수강 인증하고 후기 쓰기</Txt>
          <Txt variant="sub">
            {lec.myEnrollment === 'rejected' ? '지난 신청이 반려됐어요. 다시 올려 주세요. ' : ''}수강 내역·결제 영수증 화면을 올려 주세요. 강의 이름이 보이면 돼요. 결제 금액·카드 번호는 가려도 돼요.
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {photos.map((p) => (
              <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: radius.md }} />
            ))}
            <Pressable onPress={pick} style={{ width: 80, height: 80, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textSub, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={24} color={colors.textSub} />
            </Pressable>
          </View>
          <PrimaryButton label={busy ? '올리는 중…' : '수강 인증 신청'} onPress={enroll} disabled={busy || photos.length === 0} />
        </Card>
      )}

      <Txt variant="heading">후기 {reviews.length}</Txt>
      {reviews.length === 0 && <Txt variant="sub">아직 후기가 없어요.</Txt>}
      {reviews.map((r) => (
        <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space.sm, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Txt variant="sub" style={{ fontWeight: '800' }}>
              수강 인증
            </Txt>
            <LabelBadge label={r.label} small />
            <Stars value={r.rating} />
            <View style={{ flex: 1 }} />
            <Txt variant="sub" style={{ fontSize: 12 }}>
              {ago(r.createdAt)}
            </Txt>
          </View>
          <Txt variant="sub">
            전달력 {r.delivery} · 교재 {r.material} · 관리 {r.care}
          </Txt>
          <Txt>{r.body}</Txt>
          {r.isMine ? (
            <Pressable onPress={() => deleteLectureReview(r.id).then(load)}>
              <Txt variant="sub">삭제</Txt>
            </Pressable>
          ) : (
            <Pressable onPress={() => (uid ? setReport({ type: 'lecture_review', id: r.id }) : needWriterAlert(uid, labels))}>
              <Txt variant="sub">신고</Txt>
            </Pressable>
          )}
        </View>
      ))}
      <ReportSheet target={report} onClose={() => setReport(null)} onBlocked={load} />
      <PrimaryButton label="뒤로" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
