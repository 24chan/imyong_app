import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// 0단계 확인용 임시 화면. 1단계에서 하단 탭 구조로 바뀝니다.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>임용맵</Text>
      <Text style={styles.sub}>0단계 연결 성공 🎉</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 32, fontWeight: '800', color: '#1F5E54' },
  sub: { marginTop: 8, fontSize: 16, color: '#5B6B7C' },
});
