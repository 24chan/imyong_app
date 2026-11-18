import { Alert } from 'react-native';
import { PrimaryButton } from '../../components/ui';
import { MAX_COMPARE, useCompare } from '../../store/AppSettings';

/** '비교에 추가 / 빼기' 버튼 (바텀시트·지역 상세에서 사용) */
export function CompareButton({ region }: { region: string }) {
  const compare = useCompare();
  const added = compare.has(region);
  return (
    <PrimaryButton
      variant="ghost"
      label={added ? `비교에서 빼기 (${compare.list.length}/${MAX_COMPARE})` : `비교에 추가 (${compare.list.length}/${MAX_COMPARE})`}
      onPress={() => {
        if (!compare.toggle(region)) {
          Alert.alert('비교는 최대 3개 지역까지예요', '지역 비교 화면에서 하나를 빼고 다시 추가해 주세요.');
        }
      }}
    />
  );
}
