import { Linking, View } from 'react-native';
import { Txt } from '../../components/ui';
import { getSchoolInfo } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { openLink } from '../../lib/openLink';

/** 학교 정보 (학교알리미 공시): 학생·교원 수와 남녀, 학급 수, 설립연도 */
export function SchoolInfoBox({ region, name, kind }: { region: string; name: string; kind: 'e' | 'm' | 'h' }) {
  const { colors } = useTheme();
  const q = useAsync(() => getSchoolInfo(region, name, kind), [region, name, kind]);
  if (q.loading) return <Txt variant="sub">학교 정보를 불러오는 중…</Txt>;
  if (!q.data) return <Txt variant="sub">학교알리미 공시 정보가 아직 없어요.</Txt>;
  const { year, info: i } = q.data;
  const pct = (a?: number, b?: number) => (a != null && b != null && a + b > 0 ? Math.round((a / (a + b)) * 100) : null);
  const tw = pct(i.tw, i.tm);

  const Stat = ({ label, value, sub }: { label: string; value?: number | string; sub?: string }) => (
    <View style={{ flex: 1, minWidth: 90, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.background }}>
      <Txt variant="sub" style={{ fontSize: 12 }}>
        {label}
      </Txt>
      <Txt style={{ fontSize: 18, fontWeight: '800' }}>{value ?? '–'}</Txt>
      {!!sub && (
        <Txt variant="sub" style={{ fontSize: 12 }}>
          {sub}
        </Txt>
      )}
    </View>
  );

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Stat label="학생" value={i.st != null ? `${i.st.toLocaleString()}명` : undefined} sub={i.bm != null && i.gw != null ? `남 ${i.bm} · 여 ${i.gw}` : undefined} />
        <Stat label="교원" value={i.t != null ? `${i.t}명` : undefined} sub={i.tm != null && i.tw != null ? `남 ${i.tm} · 여 ${i.tw}` : undefined} />
        <Stat label="학급" value={i.cl != null ? `${i.cl}개` : undefined} sub={i.avg != null ? `학급당 ${i.avg}명` : undefined} />
      </View>
      {tw != null && (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.line }}>
            <View style={{ width: `${100 - tw}%`, backgroundColor: colors.cat.blue.fg }} />
            <View style={{ width: `${tw}%`, backgroundColor: colors.cat.pink.fg }} />
          </View>
          <Txt variant="sub" style={{ fontSize: 12 }}>
            교원 성비 남 {100 - tw}% · 여 {tw}%
          </Txt>
        </View>
      )}
      <Txt variant="sub" style={{ fontSize: 12 }}>
        {[i.coed, i.est ? `${i.est}년 개교` : null].filter(Boolean).join(' · ')}
        {i.hp ? ' · ' : ''}
        {i.hp && (
          <Txt variant="sub" color="brand" style={{ fontSize: 12, fontWeight: '700' }} onPress={() => openLink(i.hp!.startsWith('http') ? i.hp! : `http://${i.hp}`, '학교 홈페이지')}>
            홈페이지
          </Txt>
        )}
      </Txt>
      <Txt variant="sub" style={{ fontSize: 11 }}>
        출처: 학교알리미 {year}년 공시 (교원은 기간제·휴직자 포함)
      </Txt>
    </View>
  );
}
