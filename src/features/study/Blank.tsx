import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Txt } from '../../components/ui';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 빈칸 암기 모드 (2026-11-24 사용자 요청): 내용 체계표·개념 구조도 등 외울 곳 어디에나 붙여 쓰는 공용 부품
// <BlankScope> 안의 <BlankText>는 모드가 켜지면 가려지고, 누르면 하나씩 보임. '다시 가리기'로 처음처럼.
type Ctx = { on: boolean; round: number };
const BlankCtx = createContext<Ctx>({ on: false, round: 0 });

export function BlankScope({ on, round, children }: { on: boolean; round: number; children: ReactNode }) {
  return <BlankCtx.Provider value={{ on, round }}>{children}</BlankCtx.Provider>;
}

/** 모드 스위치 + 다시 가리기 버튼 (화면 위쪽에) */
export function BlankBar({ on, onToggle, onReset, hint = '내용 요소를 가리고, 누르면 하나씩 보여요' }: { on: boolean; onToggle: (v: boolean) => void; onReset: () => void; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: on ? colors.cat.amber.bg : colors.background }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '700' }}>빈칸 암기 모드</Txt>
        <Txt variant="sub" style={{ fontSize: 12.5 }}>
          {hint}
        </Txt>
      </View>
      {on && (
        <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cat.amber.fg }}>
          <Txt style={{ fontSize: 12.5, fontWeight: '700', color: colors.cat.amber.fg }}>다시 가리기</Txt>
        </Pressable>
      )}
      <Switch value={on} onValueChange={onToggle} accessibilityLabel="빈칸 암기 모드" trackColor={{ true: colors.cat.amber.fg, false: colors.line }} thumbColor={colors.background} />
    </View>
  );
}

/** 가릴 수 있는 글: 모드가 켜지면 회색 칸, 누르면 보임(다시 누르면 가림) */
export function BlankText({ text, size = 13.5, bold }: { text: string; size?: number; bold?: boolean }) {
  const { colors } = useTheme();
  const { on, round } = useContext(BlankCtx);
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(false), [on, round]);
  const hidden = on && !shown;
  if (!on) {
    return (
      <Txt style={{ fontSize: size, lineHeight: size * 1.5, fontWeight: bold ? '600' : '400' }}>
        {text}
      </Txt>
    );
  }
  return (
    <Pressable onPress={() => setShown((v) => !v)} accessibilityRole="button" accessibilityLabel={hidden ? '가린 칸, 눌러서 보기' : text}>
      <View style={{ borderRadius: 6, backgroundColor: hidden ? colors.cat.amber.bg : 'transparent', borderWidth: hidden ? 1 : 0, borderColor: colors.cat.amber.fg, borderStyle: 'dashed', paddingHorizontal: hidden ? 4 : 0 }}>
        <Txt style={{ fontSize: size, lineHeight: size * 1.5, fontWeight: bold ? '600' : '400', opacity: hidden ? 0 : 1 }}>{text}</Txt>
        {hidden && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ fontSize: 12, fontWeight: '700', color: colors.cat.amber.fg }}>?</Txt>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** 화면에서 쓰는 상태 묶음 */
export function useBlank() {
  const [on, setOn] = useState(false);
  const [round, setRound] = useState(0);
  return { on, setOn, round, reset: () => setRound((r) => r + 1) };
}
