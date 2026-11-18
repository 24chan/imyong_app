import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase 연결 정보
// publishable 키는 앱에 들어가도 되는 공개용 키입니다. (secret 키는 절대 넣지 말 것)
// 읽기·쓰기 권한은 DB의 RLS 정책(supabase/migrations)이 지킵니다.
export const SUPABASE_URL = 'https://wckaybzamhvmhxiacmnx.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Fss2DpcXGiGlqSkUefgIGg_mkdmz5L6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage, // v1 로그인 때 사용
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
