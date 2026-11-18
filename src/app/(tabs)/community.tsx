import { TabPlaceholder } from '../../components/TabPlaceholder';

export default function CommunityScreen() {
  return (
    <TabPlaceholder
      title="커뮤니티"
      stage="v1"
      elementary={['인증 익명 게시판 (초등 게시판 기본)', '학교 또는 교사 라벨만 표시']}
      secondary={['인증 익명 게시판 (선택 과목 게시판 기본)', '학교 또는 교사 라벨만 표시']}
    />
  );
}
