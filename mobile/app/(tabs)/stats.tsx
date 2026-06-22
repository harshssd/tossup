import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPlayerStats } from '../../lib/api';
import type { PlayerStats } from '../../lib/types';
import { useClub } from '../../lib/club';
import { Empty, Loading, Pill } from '../../lib/ui';
import { colors, radius, space } from '../../lib/theme';

type SortKey = 'total_net' | 'total_runs' | 'best_net' | 'sessions_attended' | 'total_wickets';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'total_net', label: 'Net' },
  { key: 'total_runs', label: 'Runs' },
  { key: 'best_net', label: 'Best' },
  { key: 'sessions_attended', label: 'Attendance' },
  { key: 'total_wickets', label: 'Wickets' },
];

export default function StatsScreen() {
  const { activeClubId } = useClub();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('total_net');

  const load = useCallback(async () => {
    if (!activeClubId) return;
    try {
      setStats(await getPlayerStats(activeClubId));
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

  const sorted = [...stats].sort((a, b) => (b[sort] as number) - (a[sort] as number));

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <FlatList
        data={sorted}
        keyExtractor={(s) => s.player_id}
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm }}>
            {SORTS.map((s) => (
              <Pill key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
            ))}
          </View>
        }
        ListEmptyComponent={<Empty text="No stats yet. Play a session and they'll show up here." />}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.line}>
                {item.sessions_attended} sessions · {item.total_runs} runs ({item.total_balls}b) · SR{' '}
                {item.strike_rate} · {item.total_dismissals} outs
              </Text>
              {(item.total_wickets > 0 || item.total_balls_bowled > 0) && (
                <Text style={styles.line}>
                  🎯 {item.total_wickets} wkts · {item.total_runs_conceded} conceded
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.net, { color: item.total_net >= 0 ? colors.green : colors.red }]}>
                {item.total_net}
              </Text>
              <Text style={styles.netLabel}>net · best {item.best_net}</Text>
            </View>
          </View>
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
    padding: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rank: { color: colors.textFaint, fontSize: 16, fontWeight: '800', width: 22, textAlign: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  line: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  net: { fontSize: 22, fontWeight: '800' },
  netLabel: { color: colors.textFaint, fontSize: 11 },
});
