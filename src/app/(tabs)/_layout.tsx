import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ModeToggle } from '../../components/ModeToggle';
import { useAppSettings } from '../../store/AppSettings';
import { useTheme } from '../../theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: '홈', icon: 'home-outline', iconActive: 'home' },
  { name: 'region', title: '지역·TO', icon: 'map-outline', iconActive: 'map' },
  { name: 'study', title: '스터디·자료', icon: 'book-outline', iconActive: 'book' },
  { name: 'academy', title: '학원·인강', icon: 'school-outline', iconActive: 'school' },
  { name: 'community', title: '커뮤니티', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];

export default function TabsLayout() {
  const { settings } = useAppSettings();
  const { colors } = useTheme();

  // 처음 실행이면 온보딩(초등/중등 선택)으로
  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        headerRight: () => <ModeToggle />,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSub,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={String(color)} />
            ),
            ...(t.name === 'index' && { headerShown: false }),
          }}
        />
      ))}
    </Tabs>
  );
}
