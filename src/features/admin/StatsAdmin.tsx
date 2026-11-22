import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Card, PrimaryButton, Txt } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAsync } from '../../data/useAsync';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 운영자 통계 (0025 admin_stats): 이미 있는 정보를 세기만 함, 숫자만 (누구인지 알 수 있는 값 없음)
type Stats = {
  users: { total: number; new_today: number; new_7d: number; login_today: number; login_7d: number; login_30d: number; by_provider: Record<string, number>; by_level: Record<string, number>; verified: number };
  signups_14d: { day: string; n: number }[];
  content: { posts_today: number; posts_7d: number; posts_total: number; comments_7d: number; messages_7d: number; studies_total: number; reviews_total: number };
  todo: { verifications: number; reports: number; job_tips: number; event_tips: number };
  push_subs: number;
  at: string;
};
const PROVIDER: Record<string, string> = { kakao: '카카오', google: 'Google', email: '이메일' };

async function getStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw new Error(error.message.includes('admin_stats') ? '0025 SQL을 먼저 실행해 주세요' : error.message);
  return data as Stats;
}

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <Txt variant="sub" style={{ fontSize: 12 }}>{label}</Txt>
      <Txt style={{ fontSize: 22, fontWeight: '700' }}>{value}</Txt>
      {sub && <Txt variant="sub" style={{ fontSize: 11 }}>{sub}</Txt>}
    </View>
  );
}

export function StatsAdmin() {
  const { colors } = useTheme();
  const [reload, setReload] = useState(0);
  const s = useAsync(() => getStats(), [reload]);
  if (s.loading) return <ActivityIndicator color={colors.brand} />;
  if (s.error || !s.data) return <Txt color="down">{s.error?.message ?? '불러오지 못했어요'}</Txt>;
  const { users: u, content: c, todo: t } = s.data;
  const max = Math.max(1, ...s.data.signups_14d.map((d) => d.n));
  const rows = (o: Record<string, number>, names: Record<string, string>) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${names[k] ?? k} ${n}`).join(' · ') || '없음';
  return (
    <>
      <Txt variant="heading">이용자</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Tile label="전체 가입자" value={u.total} sub={`인증 완료 ${u.verified}명`} />
        <Tile label="새 가입" value={u.new_today} sub={`오늘 · 7일 ${u.new_7d}명`} />
        <Tile label="오늘 로그인" value={u.login_today} sub="마지막 로그인 기준" />
        <Tile label="7일 · 30일 로그인" value={`${u.login_7d} · ${u.login_30d}`} />
      </View>
      <Txt variant="sub">가입 방법: {rows(u.by_provider, PROVIDER)}</Txt>
      <Txt variant="sub">모드: {rows(u.by_level, { elementary: '초등', secondary: '중등' })} · 새 공고 알림 받는 기기 {s.data.push_subs}</Txt>

      <Card style={{ borderWidth: 1, borderColor: colors.line, gap: space.sm }}>
        <Txt variant="sub">최근 14일 가입</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 72 }}>
          {s.data.signups_14d.map((d) => (
            <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              {d.n > 0 && <Txt variant="sub" style={{ fontSize: 9 }}>{d.n}</Txt>}
              <View style={{ width: '100%', height: Math.max(2, (d.n / max) * 52), backgroundColor: d.n ? colors.brand : colors.line, borderRadius: 3 }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="sub" style={{ fontSize: 10 }}>{s.data.signups_14d[0]?.day.slice(5)}</Txt>
          <Txt variant="sub" style={{ fontSize: 10 }}>오늘</Txt>
        </View>
      </Card>

      <Txt variant="heading">글·활동</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Tile label="새 글" value={c.posts_today} sub={`오늘 · 7일 ${c.posts_7d} · 전체 ${c.posts_total}`} />
        <Tile label="댓글 (7일)" value={c.comments_7d} />
        <Tile label="쪽지 (7일)" value={c.messages_7d} />
        <Tile label="스터디 · 후기" value={`${c.studies_total} · ${c.reviews_total}`} sub="전체" />
      </View>

      <Txt variant="heading">처리할 일</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Tile label="인증 대기" value={t.verifications} />
        <Tile label="신고 대기" value={t.reports} />
        <Tile label="채용 제보" value={t.job_tips} />
        <Tile label="일정 제보" value={t.event_tips} />
      </View>
      <Txt variant="sub" style={{ fontSize: 12 }}>
        기준 {new Date(s.data.at).toLocaleString('ko-KR')} · 로그인 수는 각 계정의 '마지막 로그인' 기준이라, 같은 사람이 여러 번 들어와도 1명으로 세요.
      </Txt>
      <PrimaryButton label="통계 새로고침" variant="ghost" onPress={() => setReload((n) => n + 1)} />
    </>
  );
}
