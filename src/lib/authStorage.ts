import AsyncStorage from '@react-native-async-storage/async-storage';

// 로그인 정보 저장 (보안 점검 C-2, 2026-11-22)
// - 기기 보안 저장소(iOS 키체인 / 안드로이드 Keystore 암호화, expo-secure-store)에 저장
// - 값이 커서(2KB 넘을 수 있음) 1,800자씩 나눠 저장
// - 옛 APK처럼 보안 저장소 모듈이 없으면 예전처럼 AsyncStorage 사용
// - 예전 AsyncStorage에 있던 로그인은 처음 읽을 때 보안 저장소로 옮김(다시 로그인 안 해도 됨)

type SecureStoreModule = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

let secure: SecureStoreModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('expo-secure-store') as SecureStoreModule;
  if (typeof m?.getItemAsync === 'function') secure = m;
} catch {
  secure = null;
}

const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

async function secureGet(key: string): Promise<string | null> {
  const k = safeKey(key);
  const n = await secure!.getItemAsync(`${k}.n`);
  if (n === null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(n); i++) {
    const p = await secure!.getItemAsync(`${k}.${i}`);
    if (p === null) return null; // 조각이 빠졌으면 없는 것으로 (다시 로그인)
    parts.push(p);
  }
  return parts.join('');
}

async function secureRemove(key: string) {
  const k = safeKey(key);
  const n = Number((await secure!.getItemAsync(`${k}.n`)) ?? 0);
  await secure!.deleteItemAsync(`${k}.n`);
  for (let i = 0; i < n; i++) await secure!.deleteItemAsync(`${k}.${i}`);
}

async function secureSet(key: string, value: string) {
  const k = safeKey(key);
  await secureRemove(key);
  const count = Math.ceil(value.length / CHUNK) || 1;
  for (let i = 0; i < count; i++) await secure!.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  await secure!.setItemAsync(`${k}.n`, String(count)); // 개수는 마지막에 (중간에 끊기면 없는 것으로 읽힘)
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!secure) return AsyncStorage.getItem(key);
    try {
      const v = await secureGet(key);
      if (v !== null) return v;
      const old = await AsyncStorage.getItem(key);
      if (old !== null) {
        await secureSet(key, old);
        await AsyncStorage.removeItem(key);
      }
      return old;
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!secure) return AsyncStorage.setItem(key, value);
    try {
      await secureSet(key, value);
      await AsyncStorage.removeItem(key);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    if (!secure) return;
    try {
      await secureRemove(key);
    } catch {
      /* 이미 없음 */
    }
  },
};
