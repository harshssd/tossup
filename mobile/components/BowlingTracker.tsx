import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { saveBowling } from '../lib/api';
import type { Player } from '../lib/types';
import { Card } from '../lib/ui';
import { colors, radius, space } from '../lib/theme';

export interface BowlLine {
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
}
const empty = (): BowlLine => ({ balls_bowled: 0, runs_conceded: 0, wickets: 0 });

function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

type Hist = { playerId: string; prev: BowlLine };

/**
 * Records a bowling spell per player: each tap is one legal ball with the runs
 * conceded (or a wicket). Persists to practice_bowling on every action.
 */
export function BowlingTracker({
  sessionId,
  bowlers,
  initial,
  readOnly,
}: {
  sessionId: string;
  bowlers: Player[];
  initial: Record<string, BowlLine>;
  readOnly?: boolean;
}) {
  const [lines, setLines] = useState<Record<string, BowlLine>>(initial);
  const [history, setHistory] = useState<Hist[]>([]);
  const [saving, setSaving] = useState(false);

  function apply(pid: string, runs: number, wicket: boolean) {
    const prev = lines[pid] ?? empty();
    const next: BowlLine = {
      balls_bowled: prev.balls_bowled + 1,
      runs_conceded: prev.runs_conceded + runs,
      wickets: prev.wickets + (wicket ? 1 : 0),
    };
    setHistory((h) => [...h, { playerId: pid, prev }]);
    setLines((l) => ({ ...l, [pid]: next }));
    persist(pid, next);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setLines((l) => ({ ...l, [last.playerId]: last.prev }));
    persist(last.playerId, last.prev);
  }

  async function persist(pid: string, line: BowlLine) {
    try {
      setSaving(true);
      await saveBowling(sessionId, pid, line);
    } catch {
      // local state stays; only the saving dot reflects failure
    } finally {
      setSaving(false);
    }
  }

  if (bowlers.length === 0) {
    return (
      <Card>
        <Text style={styles.dim}>No bowlers present. Mark players as bowlers in the Squad tab.</Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      {!readOnly && (
        <View style={styles.topRow}>
          <Text style={styles.hint}>Tap runs conceded or W for each ball bowled.</Text>
          <Pressable onPress={undo} disabled={history.length === 0} style={styles.undo}>
            <Text style={{ color: history.length ? colors.text : colors.textFaint, fontWeight: '700' }}>
              ↩ Undo{saving ? ' •' : ''}
            </Text>
          </Pressable>
        </View>
      )}
      {bowlers.map((b) => {
        const l = lines[b.id] ?? empty();
        const econ = l.balls_bowled > 0 ? ((l.runs_conceded / l.balls_bowled) * 6).toFixed(1) : '—';
        return (
          <Card key={b.id}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{b.name}</Text>
                <Text style={styles.dim}>
                  {b.is_regular_bowler ? 'Regular' : b.is_bowler ? 'Part-timer' : 'Occasional'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.figures}>
                  {oversText(l.balls_bowled)} ov · {l.runs_conceded}/{l.wickets}
                </Text>
                <Text style={styles.dim}>econ {econ}</Text>
              </View>
            </View>
            {!readOnly && (
              <View style={styles.grid}>
                {[0, 1, 2, 4, 6].map((r) => (
                  <Btn key={r} label={String(r)} tone={r >= 4 ? colors.amber : colors.primary} onPress={() => apply(b.id, r, false)} />
                ))}
                <Btn label="W" tone={colors.red} onPress={() => apply(b.id, 0, true)} />
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

function Btn({ label, tone, onPress }: { label: string; tone: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { borderColor: tone, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={{ color: tone, fontSize: 18, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  undo: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  dim: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  figures: { color: colors.text, fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: space.sm, marginTop: space.md, justifyContent: 'space-between' },
  btn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
  },
  hint: { color: colors.textFaint, fontSize: 12, flex: 1 },
});
