import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Txt } from '../../components/ui';
import { regionByCode } from '../../data/regions';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { RegionSummary } from '../../types/data';
import { LABELS, MAP_CREDIT, REGION_PATHS, VIEWBOX } from './mapData';
import { CHANGE_STEPS, Fill, fillFor, formatMetric, MapMetric, metricValue, quartiles } from './metrics';

const BUBBLE_W = 48;
const BUBBLE_H = 34;
const BRAND_OPACITY = [0.15, 0.35, 0.6, 0.9];
const CHANGE_OPACITY = [0, 0.35, 0.6, 0.9];

type Props = {
  rows: RegionSummary[];
  metric: MapMetric;
  selected: string | null;
  onSelect: (region: string) => void;
};

/** 전국 시도 지도. 지역 색 = 증감(선발 인원) 또는 값의 크기(경쟁률·합격선) */
export function KoreaMap({ rows, metric, selected, onSelect }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.min(e.nativeEvent.layout.width, 560));

  const byRegion = useMemo(() => Object.fromEntries(rows.map((r) => [r.region, r])), [rows]);
  const qs = useMemo(
    () => quartiles(rows.map((r) => metricValue(r, metric)).filter((v): v is number => v != null)),
    [rows, metric],
  );

  const paint = (f: Fill) => {
    if (f.tone === 'none') return { fill: colors.surface, opacity: 1 };
    if (f.tone === 'neutral') return { fill: colors.line, opacity: 1 };
    if (f.tone === 'brand') return { fill: colors.brand, opacity: BRAND_OPACITY[f.level] };
    return { fill: colors[f.tone], opacity: CHANGE_OPACITY[f.level] };
  };

  const scale = width / VIEWBOX.w;
  const height = VIEWBOX.h * scale;
  const sx = (x: number) => (x - VIEWBOX.x) * scale;
  const sy = (y: number) => (y - VIEWBOX.y) * scale;
  const hasAny = rows.some((r) => metricValue(r, metric) != null);

  return (
    <View style={{ gap: space.sm }}>
      <View onLayout={onLayout} style={{ alignItems: 'center' }}>
        {width > 0 && (
          <View style={{ width, height }}>
            <Svg width={width} height={height} viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}>
              {REGION_PATHS.map(({ code, path }) => {
                const r = byRegion[code];
                const p = r ? paint(fillFor(r, metric, qs)) : { fill: colors.surface, opacity: 1 };
                return (
                  <Path
                    key={code}
                    d={path}
                    fill={p.fill}
                    fillOpacity={p.opacity}
                    stroke={code === selected ? colors.text : colors.background}
                    strokeWidth={code === selected ? 3 : 1.5}
                    onPress={() => onSelect(code)}
                  />
                );
              })}
              {/* 작은 지역: 지역 점 → 말풍선 연결선 */}
              {Object.entries(LABELS).map(([code, l]) =>
                l.point ? (
                  <Line
                    key={`l-${code}`}
                    x1={l.point[0]}
                    y1={l.point[1]}
                    x2={l.x}
                    y2={l.y}
                    stroke={code === selected ? colors.text : colors.textSub}
                    strokeWidth={code === selected ? 2 : 1}
                  />
                ) : null,
              )}
              {Object.entries(LABELS).map(([code, l]) =>
                l.point ? <Circle key={`c-${code}`} cx={l.point[0]} cy={l.point[1]} r={3.5} fill={colors.text} /> : null,
              )}
            </Svg>

            {/* 지역 이름 + 값 말풍선 (화면 픽셀 크기로 고정) */}
            {Object.entries(LABELS).map(([code, l]) => {
              const r = byRegion[code];
              const v = r ? metricValue(r, metric) : null;
              const isSel = code === selected;
              return (
                <Pressable
                  key={code}
                  onPress={() => onSelect(code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${regionByCode(code)?.shortName} ${formatMetric(v, metric)}`}
                  hitSlop={4}
                  style={{
                    position: 'absolute',
                    left: sx(l.x) - BUBBLE_W / 2,
                    top: sy(l.y) - BUBBLE_H / 2,
                    width: BUBBLE_W,
                    height: BUBBLE_H,
                    borderRadius: radius.sm,
                    borderWidth: isSel ? 2 : 1,
                    borderColor: isSel ? colors.text : colors.line,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt variant="sub" style={{ fontSize: 10, lineHeight: 12 }}>
                    {regionByCode(code)?.shortName}
                  </Txt>
                  <Txt variant="sub" color="text" style={{ fontSize: 12, lineHeight: 14, fontWeight: '800' }}>
                    {formatMetric(v, metric)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {metric === 'selection' && hasAny && !rows.some((r) => r.changeRate != null) ? (
        <Txt variant="sub">전년 자료가 아직 없어 증감 색은 칠하지 않았어요. 숫자는 말풍선에서 볼 수 있어요.</Txt>
      ) : (
        <Legend metric={metric} qs={qs} paint={paint} hasAny={hasAny} />
      )}
      <Txt variant="sub" style={{ fontSize: 11 }}>
        {MAP_CREDIT}
      </Txt>
    </View>
  );
}

function Legend({
  metric,
  qs,
  paint,
  hasAny,
}: {
  metric: MapMetric;
  qs: number[];
  paint: (f: Fill) => { fill: string; opacity: number };
  hasAny: boolean;
}) {
  const { colors } = useTheme();
  if (!hasAny) {
    return <Txt variant="sub">이 연도는 아직 {metric === 'cutoff' ? '합격선' : '자료'}이 없어요. 이전 연도를 골라보세요.</Txt>;
  }
  const items: { f: Fill; label: string }[] =
    metric === 'selection'
      ? [
          { f: { tone: 'down', level: 3 }, label: `▼${CHANGE_STEPS[2]}%+` },
          { f: { tone: 'down', level: 2 }, label: `▼${CHANGE_STEPS[1]}%` },
          { f: { tone: 'down', level: 1 }, label: `▼${CHANGE_STEPS[0]}%` },
          { f: { tone: 'neutral', level: 0 }, label: `±${CHANGE_STEPS[0]}%` },
          { f: { tone: 'up', level: 1 }, label: `▲${CHANGE_STEPS[0]}%` },
          { f: { tone: 'up', level: 2 }, label: `▲${CHANGE_STEPS[1]}%` },
          { f: { tone: 'up', level: 3 }, label: `▲${CHANGE_STEPS[2]}%+` },
        ]
      : [
          { f: { tone: 'brand', level: 0 }, label: `~${formatMetric(qs[0], metric)}` },
          { f: { tone: 'brand', level: 1 }, label: `~${formatMetric(qs[1], metric)}` },
          { f: { tone: 'brand', level: 2 }, label: `~${formatMetric(qs[2], metric)}` },
          { f: { tone: 'brand', level: 3 }, label: `${formatMetric(qs[2], metric)}~` },
        ];
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="sub">
        {metric === 'selection' ? '색: 전년 대비 선발 인원 증감률' : `색: ${metric === 'ratio' ? '경쟁률(접수 기준)' : '1차 합격선'}이 높을수록 진하게`}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {items.map((it) => {
          const p = paint(it.f);
          return (
            <View key={it.label} style={{ flex: 1, gap: 2 }}>
              <View style={{ height: 10, borderRadius: 3, backgroundColor: colors.background }}>
                <View style={{ flex: 1, borderRadius: 3, backgroundColor: p.fill, opacity: p.opacity }} />
              </View>
              <Txt variant="sub" style={{ fontSize: 10, textAlign: 'center' }}>
                {it.label}
              </Txt>
            </View>
          );
        })}
      </View>
    </View>
  );
}
