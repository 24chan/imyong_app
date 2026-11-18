import { TabPlaceholder } from '../../components/TabPlaceholder';

// 지역·TO — MVP 3~5단계에서 지도·비교·추이 화면으로 바뀝니다.
export default function RegionScreen() {
  return (
    <TabPlaceholder
      title="지역·TO"
      stage="MVP 3~5단계"
      elementary={['시도별 초등 선발 인원 (사전예고→확정, 증감)', '전국 지도: 선발 인원/경쟁률/합격선', '지역 비교 (2~3개)', '지역별 초등 추이·합격률']}
      secondary={['과목을 고른 뒤 시도별 선발 인원', '전국 지도: 과목별 선발 인원/경쟁률/합격선', '지역 비교 (2~3개)', '지역 × 과목별 추이·합격률']}
    />
  );
}
