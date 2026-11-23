import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Card, Chip, PrimaryButton, Txt } from '../../components/ui';
import { TextInput } from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 작성자 확인 (0030): 수사기관 공문 등 법에 정한 요청이 있을 때만 (사유 입력·열람 기록 없음, 2026-11-23 사용자 결정)
export const REVEAL_TYPES = [
  ['post', '글'], ['comment', '댓글'], ['message', '쪽지'], ['study', '스터디'],
  ['lecture_review', '강의 후기'], ['mock_review', '모의고사 후기'], ['practice_review', '실습 후기'], ['user', '회원 id'],
] as const;
export type RevealType = (typeof REVEAL_TYPES)[number][0];

type Person = {
  user_id: string; email: string | null; provider: string | null; joined_at: string | null; last_sign_in_at: string | null;
  nickname: string | null; sanctions: number;
  verifications: { kind: string; method: string; status: string; label: string | null; at: string }[];
  recent_logins: { at: string; ip: string | null; action: string | null }[];
};

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

export function RevealAdmin({ initialType, initialId }: { initialType?: string; initialId?: string }) {
  const { colors } = useTheme();
  const [type, setType] = useState<RevealType>((REVEAL_TYPES.find((t) => t[0] === initialType)?.[0] ?? 'post') as RevealType);
  const [id, setId] = useState(initialId ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Person[] | null>(null);
  const run = () => {
    if (!id.trim()) return Alert.alert('번호(id)를 넣어 주세요');
    Alert.alert('작성자 정보를 확인할까요?', '수사기관 요청처럼 법에 정한 경우에만 확인해 주세요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        onPress: async () => {
          setBusy(true);
          const { data, error } = await supabase.rpc('admin_reveal_author', { p_type: type, p_id: id.trim() });
          setBusy(false);
          if (error) return Alert.alert('확인하지 못했어요', error.message.includes('admin_reveal_author') ? '0030 SQL을 먼저 실행해 주세요' : error.message);
          setResult(data as Person[]);
        },
      },
    ]);
  };

  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, color: colors.text, backgroundColor: colors.background, fontSize: 15 };
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <Txt variant="heading">작성자 확인 (수사 협조용)</Txt>
        <Txt variant="sub">
          경찰·검찰 등의 공문처럼 법에 정한 요청이 있을 때만 쓰세요. 익명 글·댓글·쪽지를 쓴 계정의 메일, 로그인 방법, 가입일, 인증 내역, 최근 로그인 기록(IP)을 보여 줘요.
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REVEAL_TYPES.map(([k, l]) => (
            <Chip key={k} label={l} selected={type === k} onPress={() => setType(k)} />
          ))}
        </View>
        <TextInput value={id} onChangeText={setId} placeholder={type === 'user' ? '회원 id' : '번호 (신고 목록·글 메뉴에서 넘어오면 자동 입력)'} placeholderTextColor={colors.textSub} style={input} autoCapitalize="none" />
        {busy ? <ActivityIndicator color={colors.brand} /> : <PrimaryButton label="작성자 확인" onPress={run} />}
      </Card>

      {result?.map((p) => (
        <Card key={p.user_id}>
          <Txt style={{ fontWeight: '700' }}>{p.email ?? '(메일 없음 · 카카오 등)'}</Txt>
          <Txt variant="sub" selectable>회원 id: {p.user_id}</Txt>
          <Txt variant="sub">로그인 방법: {p.provider ?? '-'} · 닉네임: {p.nickname ?? '-'} · 이전 제재 {p.sanctions}회</Txt>
          <Txt variant="sub">가입 {fmt(p.joined_at)} · 마지막 로그인 {fmt(p.last_sign_in_at)}</Txt>
          {p.verifications.map((v, i) => (
            <Txt key={i} variant="sub">인증: {v.label ?? v.kind} ({v.method}, {v.status}) {fmt(v.at)}</Txt>
          ))}
          <Txt variant="sub" style={{ marginTop: 4, fontWeight: '600' }}>최근 로그인 기록</Txt>
          {p.recent_logins.length === 0 && <Txt variant="sub">기록 없음 (Supabase 대시보드 Auth → Logs에서도 확인 가능)</Txt>}
          {p.recent_logins.map((l, i) => (
            <Txt key={i} variant="sub" selectable>{fmt(l.at)} · {l.ip ?? '-'} · {l.action ?? ''}</Txt>
          ))}
        </Card>
      ))}

    </View>
  );
}
