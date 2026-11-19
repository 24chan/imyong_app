import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import type { Level } from '../../store/AppSettings';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { FoundMark } from './SchoolMap';

/** 지역 상세 → 학교 지도로 가는 카드 */
export function SchoolMapLink({ region, level }: { region: string; level: Level }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/schools', params: { region, level } })}
      accessibilityRole="button"
      accessibilityLabel="학교 지도 보기"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="school-outline" size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '700' }}>학교 지도</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <FoundMark found="p" size={9} />
          <Txt variant="sub">공립</Txt>
          <FoundMark found="s" size={9} />
          <Txt variant="sub">사립</Txt>
          <Txt variant="sub">{level === 'elementary' ? '초등학교' : '중·고등학교'} 위치</Txt>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
    </Pressable>
  );
}
