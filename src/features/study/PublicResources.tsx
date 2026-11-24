import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Txt } from '../../components/ui';
import { subjectByCode } from '../../data/subjects';
import { useAppSettings } from '../../store/AppSettings';
import type { CatKey } from '../../theme/tokens';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// 공부 탭 '공개 자료' (2026-11-21 사용자 승인): 임용에 필요한 공식 공개 자료를 링크로만 모음.
// 파일을 앱에 올리지 않음(교재·강의 PDF 공유 금지 규칙). 주소는 교육청 시행계획 공고의 '참고 사이트'와 같은 공식 사이트.
type Item = { title: string; desc: string; url?: string; go?: () => void; org: string };
type Section = { key: string; title: string; icon: keyof typeof Ionicons.glyphMap; cat: CatKey; items: Item[] };

const law = (name: string) => `https://www.law.go.kr/법령/${encodeURIComponent(name)}`;

export function PublicResources() {
  const { colors } = useTheme();
  const { viewLevel, settings } = useAppSettings();
  const elem = viewLevel === 'elementary';
  const subj = !elem ? subjectByCode(settings.subjectCode)?.name : null;

  const sections: Section[] = [
    {
      key: 'past',
      title: '기출문제',
      icon: 'document-text-outline',
      cat: 'coral',
      items: [
        {
          title: elem ? '초등 임용 1차 기출 (교직논술·교육과정)' : `중등 임용 1차 기출 (교육학·${subj ?? '전공'})`,
          desc: '평가원이 공개한 연도별 문제지와 정답. 앱 안에서 바로 보고 파일도 받아요.',
          go: () => router.push('/past-exams'),
          org: '한국교육과정평가원',
        },
        {
          title: '기출 분석 (초등 교육과정 A·B) · 무료로 공개 중',
          desc: '기출이 교육과정 원문 어디서 나왔는지 형광펜으로 표시하고, 칸별 비율·연도별 교과·출제 지도·핵심어·안 나온 곳을 보여줘요. 자동 분석·참고용.',
          go: () => router.push('/exam-analysis'),
          org: '임용몽땅 분석',
        },
        {
          title: '2차 문제 (면접·수업실연)',
          desc: '지역마다 방식이 달라요. 지역별 시행계획·1차 합격 공고를 앱 안에서 바로 봐요.',
          go: () => router.push('/second-exam'),
          org: '시도교육청',
        },
      ],
    },
    {
      key: 'curr',
      title: '교육과정',
      icon: 'library-outline',
      cat: 'teal',
      items: [
        {
          title: elem ? '초등 교육과정 총론·교과별 각론 원문' : `${subj ? `${subj} ` : ''}교육과정 각론·총론 원문`,
          desc: '2022·2015 개정 고시문을 교과별로 앱 안에서 바로 봐요. 성격·목표, 내용 체계·성취기준, 교수·학습 및 평가(교육론)가 들어 있어요.',
          go: () => router.push('/curriculum'),
          org: '국가교육과정정보센터',
        },
        // 2026-11-24 사용자 요청: 원문 카드 바로 아래 내체표 → 그 아래 개념 구조도 (초등 2022 데이터)
        ...(elem
          ? [
              {
                title: '내용 체계표(내체표) 모아보기 · 빈칸 암기',
                desc: '2022 개정 교과별 내용 체계 표만 모았어요. 빈칸 암기 모드로 내용 요소를 가리고 눌러서 확인해요.',
                go: () => router.push('/content-system'),
                org: '국가교육과정정보센터 원문으로 만듦',
              },
              {
                title: '과목별 개념 구조도',
                desc: '교과 → 영역 → 범주 → 학년군 → 내용 요소를 접고 펼치는 구조도. 전체 접기로 떠올리기 연습을 해요.',
                go: () => router.push('/concept-tree'),
                org: '국가교육과정정보센터 원문으로 만듦',
              },
            ]
          : []),
        {
          title: '교과서·지도서 찾기',
          desc: '교과서 발행사와 지도서 안내.',
          url: 'https://www.textbook114.com',
          org: '교과서민원바로처리센터',
        },
      ],
    },
    {
      key: 'notice',
      title: '시험 공고 원문',
      icon: 'megaphone-outline',
      cat: 'blue',
      items: [
        {
          title: '지역별 사전예고·시행계획·합격 발표',
          desc: '17개 시도교육청 공고를 매일 모아요. 2차 방식·가산점도 공고 원문에 있어요.',
          go: () => router.push('/news'),
          org: '시도교육청',
        },
        {
          title: '임용 일정 한눈에',
          desc: '원서 접수부터 최종 발표까지 지역별 일정.',
          go: () => router.navigate('/schedule'),
          org: '시도교육청',
        },
      ],
    },
    {
      key: 'law',
      title: '관련 법령 (교직논술·면접)',
      icon: 'reader-outline',
      cat: 'purple',
      items: [
        { title: '교육기본법', desc: '교육 이념, 학습권, 교원의 지위.', url: law('교육기본법'), org: '국가법령정보센터' },
        { title: elem ? '초·중등교육법' : '초·중등교육법', desc: '학교 운영, 학생·교원, 학교운영위원회.', url: law('초·중등교육법'), org: '국가법령정보센터' },
        { title: '교육공무원법', desc: '교원의 자격·임용·연수·복무.', url: law('교육공무원법'), org: '국가법령정보센터' },
        { title: '교원의 지위 향상 및 교육활동 보호를 위한 특별법', desc: '교권 보호, 교육활동 침해 대응.', url: law('교원의 지위 향상 및 교육활동 보호를 위한 특별법'), org: '국가법령정보센터' },
      ],
    },
  ];

  return (
    <View style={{ gap: space.lg }}>
      <Txt variant="sub">공식 기관이 공개한 자료만 모았어요. 앱 안에서 바로 보고, 위의 버튼으로 원문을 열거나 파일을 받을 수 있어요.</Txt>
      {sections.map((s) => (
        <View key={s.key} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.cat[s.cat].bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={s.icon} size={17} color={colors.cat[s.cat].fg} />
            </View>
            <Txt variant="heading">{s.title}</Txt>
          </View>
          <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
            {s.items.map((it, i) => (
              <Pressable
                key={it.title}
                onPress={() => (it.go ? it.go() : it.url && router.push({ pathname: '/web', params: { url: it.url, title: it.title } }))}
                accessibilityRole={it.url ? 'link' : 'button'}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, backgroundColor: pressed ? colors.surface : 'transparent' })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '700' }}>{it.title}</Txt>
                  <Txt variant="sub">{it.desc}</Txt>
                  <Txt variant="sub" style={{ fontSize: 12, color: colors.cat[s.cat].fg, fontWeight: '700' }}>
                    {it.org}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
