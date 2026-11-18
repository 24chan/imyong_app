import { DependencyList, useEffect, useState } from 'react';
import { useAppSettings } from '../store/AppSettings';

/** repository 함수를 화면에서 부를 때 쓰는 도우미. 불러오는 중/에러/결과를 돌려줍니다. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const { dataVersion } = useAppSettings(); // 새로고침하면 다시 불러오기
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>({
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dataVersion]);
  return state;
}
