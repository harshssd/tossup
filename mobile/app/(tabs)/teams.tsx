import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createTeam, deleteTeam, listPlayers, listTeams, setPlayerTeam } from '../../lib/api';
import { useClub } from '../../lib/club';
import type { Player, Team } from '../../lib/types';
import { Button, Card, Loading } from '../../lib/ui';
import { colors, radius, space } from '../../lib/theme';

const TEAM_COLORS = ['#4f8cff', '#34d399', '#a78bfa', '#fbbf24', '#f87171', '#22d3ee'];

export default function TeamsScreen() {
  const { activeClubId } = useClub();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [picker, setPicker] = useState<Player | null>(null);

  const load = useCallback(async () => {
    if (!activeClubId) return;
    try {
      const [ts, ps] = await Promise.all([listTeams(activeClubId), listPlayers(activeClubId, true)]);
      setTeams(ts);
      setPlayers(ps);
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

  const byTeam = useMemo(() => {
    const map: Record<string, Player[]> = { pool: [] };
    for (const t of teams) map[t.id] = [];
    for (const p of players) {
      const key = p.team_id && map[p.team_id] ? p.team_id : 'pool';
      map[key].push(p);
    }
    return map;
  }, [teams, players]);

  async function addTeam() {
    if (!newName.trim() || !activeClubId) return;
    const color = TEAM_COLORS[teams.length % TEAM_COLORS.length];
    await createTeam(activeClubId, newName.trim(), color);
    setNewName('');
    load();
  }

  async function move(playerId: string, teamId: string | null) {
    setPicker(null);
    // optimistic
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, team_id: teamId } : p)));
    await setPlayerTeam(playerId, teamId);
  }

  async function removeTeam(t: Team) {
    await deleteTeam(t.id); // players fall back to the pool (ON DELETE SET NULL)
    load();
  }

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
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
      >
        <Card>
          <Text style={styles.h}>Add a team</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <TextInput
              placeholder="Team name"
              placeholderTextColor={colors.textFaint}
              value={newName}
              onChangeText={setNewName}
              style={styles.input}
              onSubmitEditing={addTeam}
              returnKeyType="done"
            />
            <Button label="Add" onPress={addTeam} disabled={!newName.trim()} />
          </View>
        </Card>

        {teams.map((t) => (
          <TeamCard
            key={t.id}
            title={t.name}
            color={t.color || colors.purple}
            members={byTeam[t.id] ?? []}
            onTapPlayer={setPicker}
            onDelete={() => removeTeam(t)}
          />
        ))}

        <TeamCard
          title="Practice pool (unassigned)"
          color={colors.textFaint}
          members={byTeam.pool ?? []}
          onTapPlayer={setPicker}
        />

        <Text style={styles.hint}>
          Tap any player to move them between teams or back to the pool. Practice sessions draw from the
          whole club, regardless of team.
        </Text>
      </ScrollView>

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Move {picker?.name}</Text>
            {teams.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.option, { borderColor: t.color || colors.purple }]}
                onPress={() => picker && move(picker.id, t.id)}
              >
                <View style={[styles.dot, { backgroundColor: t.color || colors.purple }]} />
                <Text style={styles.optionText}>{t.name}</Text>
                {picker?.team_id === t.id && <Text style={styles.current}>current</Text>}
              </Pressable>
            ))}
            <Pressable
              style={[styles.option, { borderColor: colors.border }]}
              onPress={() => picker && move(picker.id, null)}
            >
              <View style={[styles.dot, { backgroundColor: colors.textFaint }]} />
              <Text style={styles.optionText}>Practice pool (no team)</Text>
              {!picker?.team_id && <Text style={styles.current}>current</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function TeamCard({
  title,
  color,
  members,
  onTapPlayer,
  onDelete,
}: {
  title: string;
  color: string;
  members: Player[];
  onTapPlayer: (p: Player) => void;
  onDelete?: () => void;
}) {
  return (
    <Card style={{ borderColor: color }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.h}>{title}</Text>
          <Text style={styles.count}>{members.length}</Text>
        </View>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Text style={{ color: colors.red, fontSize: 12, fontWeight: '700' }}>Delete</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.chips}>
        {members.length === 0 && <Text style={styles.empty}>No players</Text>}
        {members.map((p) => (
          <Pressable key={p.id} onPress={() => onTapPlayer(p)} style={styles.chip}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{p.name}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 16, fontWeight: '800' },
  count: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  input: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.cardAlt,
  },
  empty: { color: colors.textFaint, fontSize: 13 },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  current: { color: colors.textFaint, fontSize: 12 },
});
