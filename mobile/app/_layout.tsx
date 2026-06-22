import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClubProvider } from '../lib/club';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ClubProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="club/select" options={{ title: 'Clubs', presentation: 'modal' }} />
          <Stack.Screen name="session/new" options={{ title: 'New Practice', presentation: 'modal' }} />
          <Stack.Screen name="session/[id]" options={{ title: 'Practice' }} />
        </Stack>
      </ClubProvider>
    </SafeAreaProvider>
  );
}
