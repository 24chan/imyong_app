import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export type ConsentState = { age: boolean; terms: boolean; privacy: boolean };
export const NO_CONSENT: ConsentState = { age: false, terms: false, privacy: false };
export const allAgreed = (c: ConsentState) => c.age && c.terms && c.privacy;

const ITEMS: { key: keyof ConsentState; label: string; doc?: 'terms' | 'privacy' }[] = [
  { key: 'age', label: '[필수] 만 14세 이상이에요' },
  { key: 'terms', label: '[필수] 이용약관 동의', doc: 'terms' },
  { key: 'privacy', label: '[필수] 개인정보 수집·이용 동의 (국외 이전 포함)', doc: 'privacy' },
];

/** 가입·약관 변경 때 쓰는 동의 칸: 전체 동의 + 필수 3개 */
export function ConsentBox({ value, onChange }: { value: ConsentState; onChange: (v: ConsentState) => void }) {
  const { colors } = useTheme();
  const all = allAgreed(value);

  const Check = ({ on, size = 22 }: { on: boolean; size?: number }) => (
    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={size} color={on ? colors.brand : colors.textSub} />
  );

  return (
    <View style={{ gap: space.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: all }}
        onPress={() => onChange(all ? NO_CONSENT : { age: true, terms: true, privacy: true })}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: all ? colors.brand : colors.line,
        }}
      >
        <Check on={all} size={24} />
        <Txt style={{ fontWeight: '800', flex: 1 }}>전체 동의</Txt>
      </Pressable>
      {ITEMS.map((it) => (
        <View key={it.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 6 }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value[it.key] }}
            onPress={() => onChange({ ...value, [it.key]: !value[it.key] })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}
          >
            <Check on={value[it.key]} />
            <Txt variant="sub" color="text" style={{ flex: 1 }}>
              {it.label}
            </Txt>
          </Pressable>
          {it.doc && (
            <Pressable onPress={() => router.push(`/legal/${it.doc}`)} hitSlop={8} accessibilityRole="link">
              <Txt variant="sub" style={{ textDecorationLine: 'underline' }}>
                보기
              </Txt>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}
