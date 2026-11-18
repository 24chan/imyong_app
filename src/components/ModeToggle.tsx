import { Pressable, View } from 'react-native';
import { subjectByCode } from '../data/subjects';
import { Level, levelLabel, useAppSettings } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Segmented, Txt } from './ui';

/** 상단 초등↔중등 토글: 다른 쪽 데이터를 '잠깐 보기'. 저장된 모드는 그대로 */
export function ModeToggle() {
  const { viewLevel, setViewLevel } = useAppSettings();
  return (
    <View style={{ marginRight: space.md }}>
      <Segmented<Level>
        compact
        value={viewLevel}
        onChange={setViewLevel}
        options={[
          { value: 'elementary', label: '초등' },
          { value: 'secondary', label: '중등' },
        ]}
      />
    </View>
  );
}

/** 잠깐 보기 중일 때 화면 위에 띄우는 안내 + 내 모드로 돌아가기 */
export function ViewModeBanner() {
  const { settings, viewLevel, setViewLevel } = useAppSettings();
  const { colors } = useTheme();
  if (!settings.level || settings.level === viewLevel) return null;
  return (
    <Pressable
      onPress={() => setViewLevel(settings.level!)}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.accent,
      }}
    >
      <Txt variant="sub" color="text">
        {levelLabel(viewLevel)} 데이터를 잠깐 보는 중이에요
      </Txt>
      <Txt variant="sub" color="accent" style={{ fontWeight: '700' }}>
        내 모드로 ›
      </Txt>
    </Pressable>
  );
}

/** 현재 보고 있는 모드에 맞는 설명 문구 (예: '초등' / '중등 · 수학') */
export function useModeLabel() {
  const { settings, viewLevel } = useAppSettings();
  if (viewLevel === 'elementary') return '초등';
  const subject = settings.level === 'secondary' ? subjectByCode(settings.subjectCode) : undefined;
  return subject ? `중등 · ${subject.name}` : '중등';
}
