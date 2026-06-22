import { Redirect, Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useClub } from '../../lib/club';
import { Loading } from '../../lib/ui';
import { colors } from '../../lib/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

function ClubSwitch() {
  const router = useRouter();
  const { activeClub } = useClub();
  return (
    <Pressable
      onPress={() => router.push('/club/select')}
      style={{ marginRight: 14, flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
        {activeClub?.name ?? 'Club'}
      </Text>
      <Text style={{ color: colors.textFaint, fontSize: 11 }}>▾</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { loading, activeClubId } = useClub();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </View>
    );
  }
  if (!activeClubId) return <Redirect href="/club/select" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
        headerRight: () => <ClubSwitch />,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Practice', tabBarIcon: ({ focused }) => <TabIcon emoji="🏏" focused={focused} /> }}
      />
      <Tabs.Screen
        name="players"
        options={{ title: 'Squad', tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }}
      />
      <Tabs.Screen
        name="teams"
        options={{ title: 'Teams', tabBarIcon: ({ focused }) => <TabIcon emoji="🛡️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }}
      />
    </Tabs>
  );
}
