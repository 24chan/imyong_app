import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TextInput } from '../../components/TextField';
import { PrimaryButton, Txt } from '../../components/ui';
import { submitPracticeTip, TipFile, TipTopic } from '../../data/practiceUgc';
import { useAuth } from '../../store/Auth';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Sheet } from '../community/parts';

// PDF 고르기: 옛 APK에는 모듈이 없을 수 있어서 안전하게 불러옴
type DocPicker = { getDocumentAsync(o: { type: string[]; multiple?: boolean; copyToCacheDirectory?: boolean }): Promise<{ canceled: boolean; assets?: { uri: string; name: string; mimeType?: string }[] }> };
let docPicker: DocPicker | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  docPicker = require('expo-document-picker') as DocPicker;
} catch {
  docPicker = null;
}

const TEXT: Record<TipTopic, { title: string; guide: string; privacy: string; placeholder: string; done: string }> = {
  practice: {
    title: '실습학교 목록 제보',
    guide: '학사공지 화면 캡처, 사진, PDF, 공지 주소, 직접 적은 글 — 어떤 형식이든 괜찮아요. 여러 개 섞어서 보내도 돼요(첨부 최대 5개).',
    privacy: '학생 이름이 보이면 가리고 보내 주세요. 운영자는 학교 이름·학년·학기만 옮겨 적고, 첨부 파일은 처리하자마자 지워요.',
    placeholder: '예: 2027학년도 1학기 4학년 실습 목록이에요 (선택)',
    done: '운영자가 확인해서 실습초 목록에 올릴게요.',
  },
  event: {
    title: '일정 제보 (캡처·사진·주소)',
    guide: '학원 공지·카페 글 캡처, 포스터 사진, PDF, 안내 주소 — 어떤 형식이든 괜찮아요. 모의고사·개강·설명회·특강·인강 오픈 무엇이든요(첨부 최대 5개).',
    privacy: '운영자가 날짜·장소·안내 주소만 옮겨 적고, 첨부 파일은 처리하자마자 지워요. 개인 연락처가 보이면 가려 주세요.',
    placeholder: '예: 희소 교육학 설명회 12월 둘째 주래요 (선택)',
    done: '운영자가 확인해서 일정 탭에 올릴게요.',
  },
};

/** 사진·캡처·PDF·주소·글 아무 형식으로 제보 (실습학교 목록 / 일정). 운영자가 필요한 것만 옮겨 적고 첨부는 바로 삭제 */
export function PracticeTipButton({ univ, year, label = '실습학교 목록 제보하기', topic = 'practice', variant = 'ghost' }: { univ: string; year: number | null; label?: string; topic?: TipTopic; variant?: 'ghost' | 'primary' }) {
  const tx = TEXT[topic];
  const { colors } = useTheme();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<TipFile[]>([]);
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text };
  const room = 5 - files.length;

  const addPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, allowsMultipleSelection: true, selectionLimit: Math.max(1, room) });
    if (res.canceled) return;
    setFiles((f) => [...f, ...res.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `사진${f.length + i + 1}.jpg`, mime: 'image/jpeg', base64: a.base64 }))].slice(0, 5));
  };
  const addPdf = async () => {
    if (!docPicker) return Alert.alert('PDF는 새 버전 앱에서 돼요', '지금은 사진(캡처)이나 공지 주소로 보내 주세요.');
    const res = await docPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets) return;
    setFiles((f) => [...f, ...res.assets!.map((a) => ({ uri: a.uri, name: a.name, mime: a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') }))].slice(0, 5));
  };
  const urlOk = !url.trim() || /^https?:\/\/\S+\.\S+/.test(url.trim());
  const ok = (files.length > 0 || !!url.trim() || note.trim().length >= 4) && urlOk;

  return (
    <>
      <PrimaryButton label={label} variant={variant === 'ghost' ? 'ghost' : undefined} onPress={() => (session ? setOpen(true) : router.push('/login'))} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={tx.title}>
        <Txt variant="sub">{tx.guide}</Txt>
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {tx.privacy}
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="사진·캡처" variant="ghost" disabled={room <= 0} onPress={addPhotos} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="PDF·파일" variant="ghost" disabled={room <= 0} onPress={addPdf} />
          </View>
        </View>
        {files.map((f, i) => (
          <View key={`${f.uri}${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name={f.mime === 'application/pdf' ? 'document-text-outline' : 'image-outline'} size={18} color={colors.textSub} />
            <Txt style={{ flex: 1 }} numberOfLines={1}>
              {f.name}
            </Txt>
            <Pressable onPress={() => setFiles((x) => x.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel="첨부 빼기" hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textSub} />
            </Pressable>
          </View>
        ))}
        <TextInput value={url} onChangeText={setUrl} placeholder="공지 주소 https://... (선택)" placeholderTextColor={colors.textSub} autoCapitalize="none" keyboardType="url" style={input} />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={tx.placeholder}
          placeholderTextColor={colors.textSub}
          multiline
          maxLength={500}
          style={[input, { minHeight: 70, textAlignVertical: 'top' }]}
        />
        {!urlOk && <Txt color="down">주소는 https:// 로 시작해야 해요.</Txt>}
        <PrimaryButton
          label={busy ? '보내는 중…' : '제보 보내기'}
          disabled={!ok || busy}
          onPress={() => {
            if (!session) return;
            setBusy(true);
            submitPracticeTip(session.user.id, { topic, univ, year, note: note.trim(), url: url.trim(), files })
              .then(() => {
                setOpen(false);
                setFiles([]);
                setNote('');
                setUrl('');
                Alert.alert('고마워요!', tx.done);
              })
              .catch((e) => Alert.alert('보내지 못했어요', (e as Error).message))
              .finally(() => setBusy(false));
          }}
        />
      </Sheet>
    </>
  );
}
