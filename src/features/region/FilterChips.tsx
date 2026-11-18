import { ScrollView, View } from 'react-native';
import { Chip, Txt } from '../../components/ui';
import { subjectByCode } from '../../data/subjects';
import { useAppSettings } from '../../store/AppSettings';
import { space } from '../../theme/tokens';
import type { useRegionFilters } from './useRegionFilters';

type Filters = ReturnType<typeof useRegionFilters>;

/** 연도 칩 + (중등) 과목 칩 */
export function FilterChips({ f }: { f: Filters }) {
  const { settings } = useAppSettings();
  return (
    <View style={{ gap: space.sm }}>
      {f.years && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {f.years.map((y) => (
            <Chip key={y} label={`${y}학년도`} selected={f.year === y} onPress={() => f.setYear(y)} />
          ))}
        </ScrollView>
      )}
      {f.isSecondary && f.subjects && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {f.subjects.map((code) => (
            <Chip
              key={code}
              label={subjectByCode(code)?.name ?? code}
              selected={f.subject === code}
              onPress={() => f.setSubject(code)}
            />
          ))}
        </ScrollView>
      )}
      {f.isSecondary && f.mySubjectMissing && (
        <Txt variant="sub" color="accent">
          내 과목({subjectByCode(settings.subjectCode)?.name})은 아직 샘플 데이터가 없어요.
        </Txt>
      )}
    </View>
  );
}
