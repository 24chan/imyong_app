import { TabPlaceholder } from '../../components/TabPlaceholder';

// 홈 — MVP 6단계에서 D-day·관심 지역 요약으로 채웁니다.
export default function HomeScreen() {
  return (
    <TabPlaceholder
      title="홈"
      stage="MVP 6단계"
      elementary={['초등 D-day (1차 11월 초, 시행계획 9월 초)', '관심 지역의 초등 선발 인원·증감', '새 스터디, 인기글']}
      secondary={['중등 D-day (1차 11월 말, 시행계획 9월 말)', '관심 과목 × 관심 지역 선발 인원·증감', '새 스터디, 인기글']}
    />
  );
}
