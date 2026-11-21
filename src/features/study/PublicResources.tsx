import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
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
          title: elem ? '초등 임용 1차 기출 (교육학·교육과정)' : `중등 임용 1차 기출 (교육학·${subj ?? '전공'})`,
          desc: '한국교육과정평가원이 공개한 연도별 문제지와 정답. 누리집 자료실에서 교원임용시험을 찾아요.',
          url: 'https://www.kice.re.kr',
          org: '한국교육과정평가원',
        },
        {
          title: '2차 문제 (면접·수업실연)',
          desc: '지역 교육청마다 공개 범위가 달라요. 지역 공고(임용 소식)에서 확인해요.',
          go: () => router.push('/news'),
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
          title: elem ? '초등 교육과정 총론·교과별 각론' : `${subj ? `${subj} ` : ''}교육과정 각론·총론`,
          desc: '내용 체계표와 성취기준은 교과별 각론 안에 있어요. 출제 범위가 되는 고시 번호는 시행계획 공고에서 확인해요.',
          url: 'https://ncic.go.kr',
          org: '국가교육과정정보센터',
        },
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
      <Txt variant="sub">공식 기관이 공개한 자료만 링크로 모았어요. 파일은 각 기관 누리집에서 받아요.</Txt>
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
                onPress={() => (it.go ? it.go() : it.url && Linking.openURL(it.url))}
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
                <Ionicons name={it.url ? 'open-outline' : 'chevron-forward'} size={18} color={colors.textSub} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
