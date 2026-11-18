import { View } from 'react-native';
import { REGIONS } from '../data/regions';
import { SUBJECTS } from '../data/subjects';
import { space } from '../theme/tokens';
import { Chip } from './ui';

// 온보딩과 설정에서 같이 쓰는 선택 목록

export function SubjectPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (code: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {SUBJECTS.map((s) => (
        <Chip key={s.code} label={s.name} selected={value === s.code} onPress={() => onChange(s.code)} />
      ))}
    </View>
  );
}

export function RegionPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {REGIONS.map((r) => (
        <Chip key={r.code} label={r.shortName} selected={value.includes(r.code)} onPress={() => toggle(r.code)} />
      ))}
    </View>
  );
}
