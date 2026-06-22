import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPlayer, listPlayers, listTeams, updatePlayer } from '../../lib/api';
import type { Player, Team } from '../../lib/types';
import { useClub } from '../../lib/club';
import { Button, Card, Empty, Loading, Pill } from '../../lib/ui';
import { colors, radius, space } from '../../lib/theme';

export default function PlayersScreen() {
  const { activeClubId } = useClub();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [isBatsman, setIsBatsman] = useState(true);
  const [isBowler, setIsBowler] = useState(false);
  const [isRegular, setIsRegular] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeClubId) return;
    try {
      setError(null);
      const [ps, ts] = await Promise.all([listPlayers(activeClubId, true), listTeams(activeClubId)]);
      setPlayers(ps);
      setTeams(ts);
    } catch (e) {
      setError((e as Error).message);
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

  async function add() {
    if (!name.trim() || !activeClubId) return;
    setSaving(true);
    try {
      await createPlayer({
        club_id: activeClubId,
        name: name.trim(),
        is_batsman: isBatsman,
        is_bowler: isBowler,
        is_regular_bowler: isBowler && isRegular,
      });
      setName('');
      setIsBatsman(true);
      setIsBowler(false);
      setIsRegular(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Player) {
    await updatePlayer(p.id, { active: !p.active });
    load();
  }

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
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
            <Card style={{ marginBottom: space.md }}>
              <Text style={styles.formTitle}>Add player</Text>
              <TextInput
                placeholder="Player name"
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={setName}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={add}
              />
              <View style={styles.row}>
                <Pill label="🏏 Batsman" tone="primary" active={isBatsman} onPress={() => setIsBatsman((v) => !v)} />
                <Pill label="🎯 Bowler" tone="green" active={isBowler} onPress={() => setIsBowler((v) => !v)} />
                {isBowler && (
                  <Pill
                    label={isRegular ? 'Regular' : 'Part-timer'}
                    tone="amber"
                    active={isRegular}
                    onPress={() => setIsRegular((v) => !v)}
                  />
                )}
              </View>
              <Button label={saving ? 'Adding…' : 'Add to squad'} onPress={add} disabled={saving || !name.trim()} style={{ marginTop: space.md }} />
              {error && <Text style={styles.error}>{error}</Text>}
            </Card>
          }
          ListEmptyComponent={<Empty text="No players yet. Add your squad above." />}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => toggleActive(item)}>
              <Card style={[styles.playerCard, !item.active && { opacity: 0.45 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <View style={[styles.row, { marginTop: 6 }]}>
                    {(() => {
                      const team = teams.find((t) => t.id === item.team_id);
                      return team ? (
                        <Tag text={team.name} color={team.color || colors.purple} />
                      ) : (
                        <Tag text="Pool" color={colors.textFaint} />
                      );
                    })()}
                    {item.is_batsman && <Tag text="Batsman" color={colors.primary} />}
                    {item.is_bowler && (
                      <Tag
                        text={item.is_regular_bowler ? 'Regular bowler' : 'Part-time bowler'}
                        color={item.is_regular_bowler ? colors.green : colors.amber}
                      />
                    )}
                    {!item.active && <Tag text="Inactive" color={colors.textFaint} />}
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
          ListFooterComponent={
            players.length > 0 ? (
              <Text style={styles.hint}>Long-press a player to toggle active / inactive.</Text>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  formTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: space.md },
  input: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: space.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  playerCard: { flexDirection: 'row', alignItems: 'center' },
  playerName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  tag: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  error: { color: colors.red, marginTop: space.sm },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: space.md },
});
