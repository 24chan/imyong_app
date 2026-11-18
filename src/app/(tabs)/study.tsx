import { TabPlaceholder } from '../../components/TabPlaceholder';

export default function StudyScreen() {
  return (
    <TabPlaceholder
      title="스터디·자료"
      stage="v1"
      elementary={['스터디 모집 (초등 필터 기본)', '직접 작성한 요약 자료', '모의고사 일정·후기·점수 비교']}
      secondary={['스터디 모집 (선택 과목 필터 기본)', '직접 작성한 요약 자료', '모의고사 일정·후기·점수 비교']}
    />
  );
}
