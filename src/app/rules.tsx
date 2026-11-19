import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Card, Screen, Txt } from '../components/ui';
import { space } from '../theme/tokens';

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: '누가 쓸 수 있나요',
    items: [
      '학교(교대·사범대) 또는 교사 인증을 한 사람만 글·댓글·쪽지를 쓸 수 있어요. 보기는 누구나 할 수 있어요.',
      '다른 사람에게는 라벨(예: 서울교대, 중등교사)만 보여요. 재학/졸업, 기간제/정교사, 지역은 표시하지 않아요.',
      '댓글은 글마다 익명1·익명2…로 번호가 붙고, 글쓴이 댓글에는 "글쓴이"가 표시돼요.',
    ],
  },
  {
    title: '하면 안 되는 것',
    items: [
      '교재·강의 PDF, 유료 자료 파일·사진 공유 (쪽지 포함)',
      '실명·연락처·학교·지역 등 다른 사람을 알아볼 수 있는 정보 노출',
      '학원·인강·상품 광고, 후기를 가장한 홍보',
      '정치·사회 갈등 글, 혐오·비하·욕설, 특정인 저격',
      '음란물, 불법 촬영물, 도배·낚시 글',
    ],
  },
  {
    title: '신고와 자동 숨김',
    items: [
      '글·댓글·쪽지는 메뉴에서 신고할 수 있어요. 서로 다른 5명이 신고하면 자동으로 가려지고 운영자가 확인해요.',
      '권리 침해 신고가 들어온 글은 최대 30일 동안 임시로 가려질 수 있어요 (임시조치).',
      '차단하면 그 사람의 글·댓글이 보이지 않고 쪽지도 주고받을 수 없어요. 설정에서 차단을 모두 풀 수 있어요.',
    ],
  },
  {
    title: '이용 제한 (단계별)',
    items: [
      '경고 → 글쓰기 7일 제한 → 30일 제한 → 영구 제한',
      '위반이 심하면 바로 높은 단계가 적용될 수 있어요. 제한 중에는 글·댓글·쪽지를 쓸 수 없어요.',
      '제한 사유는 커뮤니티 화면 위에 표시되고, 제한마다 한 번 이의 신청을 할 수 있어요.',
    ],
  },
  {
    title: '쪽지',
    items: [
      '글·댓글의 메뉴에서 시작해요. 글자와 사진을 보낼 수 있어요 (파일은 안 돼요).',
      '새 대화는 하루 20개까지, 상대가 답장하기 전에는 3통까지 보낼 수 있어요.',
      '쪽지 받기는 설정에서 끌 수 있어요. 운영자는 신고된 쪽지만 확인해요.',
    ],
  },
];

export default function RulesScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: '커뮤니티 이용 규칙' }} />
      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <Txt variant="heading">{s.title}</Txt>
          <View style={{ gap: space.xs }}>
            {s.items.map((t) => (
              <Txt key={t}>· {t}</Txt>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
