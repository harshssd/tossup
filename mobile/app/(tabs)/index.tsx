import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listSessions } from '../../lib/api';
import type { PracticeSession } from '../../lib/types';
import { useClub } from '../../lib/club';
import { Button, Empty, Loading } from '../../lib/ui';
import { colors, radius, space } from '../../lib/theme';

const STATUS_TONE: Record<string, string> = {
  SETUP: colors.amber,
  LIVE: colors.green,
  COMPLETED: colors.textFaint,
};

export default function SessionsScreen() {
  const router = useRouter();
  const { activeClubId } = useClub();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeClubId) return;
    try {
      setSessions(await listSessions(activeClubId));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeClubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <Link href="/session/new" asChild>
            <Button label="+ New practice session" onPress={() => {}} style={{ marginBottom: space.md }} />
          </Link>
        }
        ListEmptyComponent={
          <Empty text={'No practice sessions yet.\nStart one to track scores and attendance.'} />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/session/${item.id}`)}>
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.name || 'Practice'}</Text>
                <Text style={styles.meta}>
                  {item.session_date} · {item.balls_per_batsman} balls · −{item.out_penalty} per out
                </Text>
              </View>
              <View style={[styles.status, { borderColor: STATUS_TONE[item.status] }]}>
                <Text style={{ color: STATUS_TONE[item.status], fontSize: 11, fontWeight: '800' }}>
                  {item.status}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  status: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
