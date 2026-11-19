import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { getPrivateRegions } from '../../data/repository';
import { useAsync } from '../../data/useAsync';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { FoundMark } from '../region/SchoolMap';

/** '사립 위탁 채용' 화면으로 가는 카드. region 을 주면 그 지역 자료가 있을 때만 보임 */
export function PrivateLink({ region }: { region?: string }) {
  const { colors } = useTheme();
  const regions = useAsync(() => getPrivateRegions(), []);
  const has = region ? (regions.data?.[region] ?? []).length > 0 : Object.keys(regions.data ?? {}).length > 0;
  if (!has) return null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/private', params: region ? { region } : {} })}
      accessibilityRole="button"
      accessibilityLabel="사립 위탁 채용 학교·과목·인원 보기"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.accent + '66',
        backgroundColor: colors.accent + '14',
      }}
    >
      <FoundMark found="s" size={14} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '700' }}>사립 위탁 채용 표</Txt>
        <Txt variant="sub">법인·학교·과목별 채용 인원 (교육청 공고 기준)</Txt>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
    </Pressable>
  );
}
