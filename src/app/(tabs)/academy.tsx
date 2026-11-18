import { TabPlaceholder } from '../../components/TabPlaceholder';

export default function AcademyScreen() {
  return (
    <TabPlaceholder
      title="학원·인강"
      stage="v1"
      elementary={['교육학 + 초등 강의 후기 (수강 인증자만)', '학원별 개강·특강·모의고사 캘린더']}
      secondary={['교육학 + 선택 과목 전공 강의 후기 (수강 인증자만)', '학원별 개강·특강·모의고사 캘린더']}
    />
  );
}
