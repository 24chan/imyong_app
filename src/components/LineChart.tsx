import { useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Txt } from './ui';

// 꺾은선 그래프 (react-native-svg, Expo Go에 포함)
// 규칙: 축 하나, 선 2px, 점 8px, 계열이 2개 이상이면 범례 + 선 모양(실선/점선)·점 모양으로도 구분.
// 그래프를 누르면 그 해의 값이 위에 표시됩니다.

export type Series = {
  key: string;
  label: string;
  tone: 'brand' | 'accent';
  dashed?: boolean;
  shape?: 'circle' | 'square';
  values: (number | null)[];
};

type Props = {
  labels: string[]; // x축 (예: '18', '19' …)
  series: Series[];
  formatValue: (v: number) => string;
  selectedIndex: number;
  onSelect: (i: number) => void;
  /** 선택한 지점 위에 보일 제목 (예: '2024학년도') */
  titleFor: (i: number) => string;
  height?: number;
};

const PAD = { top: 12, right: 14, bottom: 24, left: 40 };

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    min = min === 0 ? 0 : min * 0.9;
    max = max === 0 ? 1 : max * 1.1;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

export function LineChart({ labels, series, formatValue, selectedIndex, onSelect, titleFor, height = 190 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const ticks = all.length ? niceTicks(Math.min(...all), Math.max(...all)) : [0, 1];
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const pathFor = (values: (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const pick = (locX: number) => {
    if (n === 0 || plotW === 0) return;
    const i = Math.round(((locX - PAD.left) / plotW) * (n - 1));
    onSelect(Math.min(n - 1, Math.max(0, i)));
  };

  const sel = Math.min(Math.max(selectedIndex, 0), n - 1);

  return (
    <View style={{ gap: space.sm }}>
      {/* 선택한 해의 값 (툴팁 역할) */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Txt variant="sub" style={{ fontWeight: '700' }} color="text">
          {titleFor(sel)}
        </Txt>
        {series.map((s) => {
          const v = s.values[sel];
          return (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <LegendMark series={s} />
              <Txt variant="sub" color="text">
                {series.length > 1 ? `${s.label} ` : ''}
                <Txt variant="sub" color="text" style={{ fontWeight: '800' }}>
                  {v != null ? formatValue(v) : '자료 없음'}
                </Txt>
              </Txt>
            </View>
          );
        })}
      </View>

      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Pressable
            style={{ flex: 1 }}
            onPressIn={(e) => pick(e.nativeEvent.locationX)}
            accessibilityRole="adjustable"
            accessibilityLabel="그래프. 눌러서 연도 선택"
          >
            <Svg width={width} height={height}>
              {/* 가로 눈금선 + y축 숫자 */}
              {ticks.map((t) => (
                <G key={t}>
                  <Line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
                  <SvgText x={PAD.left - 6} y={y(t) + 4} fontSize={11} fill={colors.textSub} textAnchor="end">
                    {formatValue(t)}
                  </SvgText>
                </G>
              ))}
              {/* x축 연도 */}
              {labels.map((l, i) => (
                <SvgText
                  key={l}
                  x={x(i)}
                  y={height - 6}
                  fontSize={11}
                  fill={i === sel ? colors.text : colors.textSub}
                  fontWeight={i === sel ? '700' : '400'}
                  textAnchor="middle"
                >
                  {l}
                </SvgText>
              ))}
              {/* 선택 세로선 */}
              <Line x1={x(sel)} x2={x(sel)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.textSub} strokeWidth={1} strokeDasharray="3,3" />
              {/* 선과 점 */}
              {series.map((s) => {
                const c = colors[s.tone];
                return (
                  <G key={s.key}>
                    <Path
                      d={pathFor(s.values)}
                      stroke={c}
                      strokeWidth={2}
                      fill="none"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={s.dashed ? '6,4' : undefined}
                    />
                    {s.values.map((v, i) => {
                      if (v == null) return null;
                      const big = i === sel;
                      const r = big ? 5.5 : 4;
                      return s.shape === 'square' ? (
                        <Rect
                          key={i}
                          x={x(i) - r}
                          y={y(v) - r}
                          width={r * 2}
                          height={r * 2}
                          rx={1.5}
                          fill={c}
                          stroke={colors.surface}
                          strokeWidth={2}
                        />
                      ) : (
                        <Circle key={i} cx={x(i)} cy={y(v)} r={r} fill={c} stroke={colors.surface} strokeWidth={2} />
                      );
                    })}
                  </G>
                );
              })}
            </Svg>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** 범례 표시: 선 모양 + 점 모양 (색만으로 구분하지 않도록) */
export function LegendMark({ series }: { series: Pick<Series, 'tone' | 'dashed' | 'shape'> }) {
  const { colors } = useTheme();
  const c = colors[series.tone];
  return (
    <Svg width={22} height={10}>
      <Line x1={0} x2={22} y1={5} y2={5} stroke={c} strokeWidth={2} strokeDasharray={series.dashed ? '4,3' : undefined} />
      {series.shape === 'square' ? (
        <Rect x={7} y={1} width={8} height={8} rx={1.5} fill={c} />
      ) : (
        <Circle cx={11} cy={5} r={4} fill={c} />
      )}
    </Svg>
  );
}
