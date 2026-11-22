import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { toggleScrap, useScraps } from '../../store/schoolScraps';
import { space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { openRegionSchools } from '../region/NationalSchoolMap';
import { FoundMark } from '../region/SchoolMap';
import { openTransitRoute } from './route';

// 스크랩한 학교 모아보기 (기기에만 저장)
export function MyScraps() {
  const { colors } = useTheme();
  const list = useScraps();
  if (!list.length)
    return <Txt variant="sub">아직 스크랩한 학교가 없어요. 지도나 실습초 목록에서 학교를 누르고 ☆를 눌러 보세요.</Txt>;
  return (
    <View>
      <Txt variant="sub" style={{ fontSize: 12, marginBottom: space.sm }}>스크랩은 이 폰에만 저장돼요. 학교 이름을 누르면 그 지역 학교 지도에서 보여요.</Txt>
      {list.map((s) => (
        <View key={`${s.region}|${s.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <FoundMark found={s.found} size={10} />
          <Pressable style={{ flex: 1 }} onPress={() => openRegionSchools(s.region, !s.kind || s.kind === 'e' ? 'elementary' : 'secondary', s.name)} accessibilityRole="button">
            <Txt style={{ fontWeight: '700' }}>{s.name}</Txt>
            <Txt variant="sub" style={{ fontSize: 12 }}>
              {regionByCode(s.region)?.shortName} {s.sigungu}
            </Txt>
          </Pressable>
          <Pressable onPress={() => openTransitRoute(s)} accessibilityRole="button" accessibilityLabel="내 위치에서 길찾기" hitSlop={8}>
            <Ionicons name="navigate-outline" size={20} color={colors.brand} />
          </Pressable>
          <Pressable onPress={() => toggleScrap(s)} accessibilityRole="button" accessibilityLabel="스크랩 해제" hitSlop={8}>
            <Ionicons name="star" size={22} color={colors.accent} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
