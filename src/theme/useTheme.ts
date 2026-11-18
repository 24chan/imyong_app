import { useColorScheme } from 'react-native';
import { useAppSettings } from '../store/AppSettings';
import { darkColors, lightColors } from './tokens';

/** 시스템 설정을 따르되, 설정에서 라이트/다크를 고르면 그 값을 사용 */
export function useTheme() {
  const system = useColorScheme();
  const { settings } = useAppSettings();
  const scheme: 'light' | 'dark' =
    settings.themePref === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.themePref;
  return { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
}
