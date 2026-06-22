import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getHistoricalOrders,
  getSession,
  listAttendance,
  listBatting,
  listBowling,
  listPlayers,
  saveBatting,
  setSessionStatus,
  upsertAttendance,
} from '../../lib/api';
import { fairBattingOrder, netScore, shuffleOrder } from '../../lib/scoring';
import type { Attendance, Batting, Bowling, Player, PracticeSession } from '../../lib/types';
import { Button, Card, Loading } from '../../lib/ui';
import { BowlingTracker, type BowlLine } from '../../components/BowlingTracker';
import { colors, radius, space } from '../../lib/theme';

interface BatLine {
  balls_faced: number;
  runs: number;
  fours: number;
  sixes: number;
  dots: number;
  dismissals: number;
}
const emptyLine = (): BatLine => ({ balls_faced: 0, runs: 0, fours: 0, sixes: 0, dots: 0, dismissals: 0 });

type HistEvent = { playerId: string; prev: BatLine };

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [order, setOrder] = useState<string[]>([]); // playerIds in batting order
  const [bat, setBat] = useState<Record<string, BatLine>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<HistEvent[]>([]);
  const [bowling, setBowling] = useState<Record<string, BowlLine>>({});
  const [mode, setMode] = useState<'BAT' | 'BOWL'>('BAT');
  const [arrivalSeq, setArrivalSeq] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const s = await getSession(id);
    const [ps, att, batting, bowlingRows] = await Promise.all([
      listPlayers(s.club_id ?? '', true),
      listAttendance(id),
      listBatting(id),
      listBowling(id),
    ]);
    setSession(s);
    setPlayers(ps);

    const attByPlayer = new Map<string, Attendance>(att.map((a) => [a.player_id, a]));
    // Present map: existing attendance wins; otherwise default active players to present.
    const pres: Record<string, boolean> = {};
    for (const p of ps) {
      const a = attByPlayer.get(p.id);
      pres[p.id] = a ? a.present : p.active;
    }
    setPresent(pres);

    const ordered = att
      .filter((a) => a.present && a.batting_order != null)
      .sort((a, b) => (a.batting_order ?? 0) - (b.batting_order ?? 0))
      .map((a) => a.player_id);
    setOrder(ordered);

    // Restore arrival sequence (who reached first), ordered by arrival_order.
    setArrivalSeq(
      att
        .filter((a) => a.present && a.arrival_order != null)
        .sort((a, b) => (a.arrival_order ?? 0) - (b.arrival_order ?? 0))
        .map((a) => a.player_id),
    );

    const bmap: Record<string, BatLine> = {};
    for (const b of batting as Batting[]) {
      bmap[b.player_id] = {
        balls_faced: b.balls_faced,
        runs: b.runs,
        fours: b.fours,
        sixes: b.sixes,
        dots: b.dots,
        dismissals: b.dismissals,
      };
    }
    setBat(bmap);

    const wmap: Record<string, BowlLine> = {};
    for (const w of bowlingRows as Bowling[]) {
      wmap[w.player_id] = {
        balls_bowled: w.balls_bowled,
        runs_conceded: w.runs_conceded,
        wickets: w.wickets,
      };
    }
    setBowling(wmap);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const presentPlayers = useMemo(
    () => players.filter((p) => present[p.id]),
    [players, present],
  );

  const playerName = useCallback(
    (pid: string) => players.find((p) => p.id === pid)?.name ?? '—',
    [players],
  );

  if (loading || !session) return <Loading />;

  // ----- SETUP -----------------------------------------------------------
  // Toggling attendance also records arrival order (who reached the ground first).
  function togglePresent(pid: string) {
    setPresent((m) => {
      const nowPresent = !m[pid];
      setArrivalSeq((seq) => (nowPresent ? [...seq.filter((x) => x !== pid), pid] : seq.filter((x) => x !== pid)));
      return { ...m, [pid]: nowPresent };
    });
  }

  async function assignOrder(kind: 'fair' | 'random' | 'arrival') {
    setBusy(true);
    try {
      const ids = presentPlayers.map((p) => p.id);
      let result: string[];
      if (kind === 'fair') {
        const hist = await getHistoricalOrders();
        result = fairBattingOrder(
          ids.map((pid) => ({
            playerId: pid,
            avgHistoricalOrder: hist[pid] ?? null,
            rand: Math.random(),
          })),
        );
      } else if (kind === 'arrival') {
        // Present players in arrival order; any present-but-untracked appended after.
        const seq = arrivalSeq.filter((pid) => present[pid]);
        result = [...seq, ...ids.filter((pid) => !seq.includes(pid))];
      } else {
        result = shuffleOrder(ids, ids.map(() => Math.random()));
      }
      setOrder(result);
      await upsertAttendance(
        players.map((p) => ({
          session_id: session!.id,
          player_id: p.id,
          present: !!present[p.id],
          arrival_order: arrivalSeq.includes(p.id) ? arrivalSeq.indexOf(p.id) + 1 : null,
          batting_order: result.includes(p.id) ? result.indexOf(p.id) + 1 : null,
        })),
      );
    } finally {
      setBusy(false);
    }
  }

  async function startPractice() {
    setBusy(true);
    try {
      await setSessionStatus(session!.id, 'LIVE');
      setSession({ ...session!, status: 'LIVE' });
      setCurrent(order[0] ?? null);
    } finally {
      setBusy(false);
    }
  }

  // ----- LIVE ------------------------------------------------------------
  const currentId = current ?? order.find((pid) => (bat[pid]?.balls_faced ?? 0) < session.balls_per_batsman) ?? null;

  function record(runs: number, isOut: boolean) {
    if (!currentId) return;
    const prev = bat[currentId] ?? emptyLine();
    if (prev.balls_faced >= session!.balls_per_batsman) return; // innings full
    const next: BatLine = {
      balls_faced: prev.balls_faced + 1,
      runs: prev.runs + (isOut ? 0 : runs),
      fours: prev.fours + (!isOut && runs === 4 ? 1 : 0),
      sixes: prev.sixes + (!isOut && runs === 6 ? 1 : 0),
      dots: prev.dots + (!isOut && runs === 0 ? 1 : 0),
      dismissals: prev.dismissals + (isOut ? 1 : 0),
    };
    setHistory((h) => [...h, { playerId: currentId, prev }]);
    setBat((b) => ({ ...b, [currentId]: next }));
    persist(currentId, next);
    // Auto-advance when this batter's innings is complete.
    if (next.balls_faced >= session!.balls_per_batsman) {
      const idx = order.indexOf(currentId);
      const nextId = order.slice(idx + 1).find((pid) => (bat[pid]?.balls_faced ?? 0) < session!.balls_per_batsman);
      setCurrent(nextId ?? null);
    }
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setBat((b) => ({ ...b, [last.playerId]: last.prev }));
    persist(last.playerId, last.prev);
    setCurrent(last.playerId);
  }

  async function persist(pid: string, line: BatLine) {
    try {
      setBusy(true);
      await saveBatting(session!.id, pid, line, session!.out_penalty);
    } catch {
      // keep local state; surfaced via the saving dot only
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await setSessionStatus(session!.id, 'COMPLETED');
    setSession({ ...session!, status: 'COMPLETED' });
  }
  async function reopen() {
    await setSessionStatus(session!.id, 'LIVE');
    setSession({ ...session!, status: 'LIVE' });
  }

  const leaderboard = order
    .map((pid) => {
      const l = bat[pid] ?? emptyLine();
      return { pid, ...l, net: netScore(l.runs, l.dismissals, session.out_penalty) };
    })
    .sort((a, b) => b.net - a.net);

  // Anyone present can bowl; surface regular bowlers first, then part-timers.
  const presentBowlers = presentPlayers
    .slice()
    .sort(
      (a, b) =>
        Number(b.is_regular_bowler) - Number(a.is_regular_bowler) ||
        Number(b.is_bowler) - Number(a.is_bowler),
    );

  // ===== Render ==========================================================
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{session.name || 'Practice'}</Text>
          <View style={[styles.statusChip, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>{session.status}</Text>
            {busy && <View style={styles.savingDot} />}
          </View>
        </View>
        <Text style={styles.sub}>
          {session.session_date} · {session.balls_per_batsman} balls/batter · −{session.out_penalty} per out
        </Text>

        {session.status === 'SETUP' && (
          <>
            <Card>
              <Text style={styles.cardTitle}>Who showed up? ({presentPlayers.length})</Text>
              <Text style={styles.hint}>Tap in arrival order — first tap = reached first.</Text>
              <View style={styles.chips}>
                {players.map((p) => {
                  const arrivalPos = arrivalSeq.indexOf(p.id);
                  return (
                  <Pressable key={p.id} onPress={() => togglePresent(p.id)}>
                    <View
                      style={[
                        styles.attChip,
                        present[p.id]
                          ? { backgroundColor: colors.primaryDim, borderColor: colors.primary }
                          : { borderColor: colors.border },
                      ]}
                    >
                      <Text style={{ color: present[p.id] ? colors.text : colors.textFaint, fontWeight: '700' }}>
                        {present[p.id] && arrivalPos >= 0 ? `${arrivalPos + 1}. ` : ''}
                        {p.name}
                      </Text>
                    </View>
                  </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Batting order</Text>
              <Text style={styles.hint}>
                Fair balances who opens over time · Random shuffles · Arrival uses who reached first.
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                <Button
                  label="🎲 Fair"
                  variant="primary"
                  onPress={() => assignOrder('fair')}
                  disabled={busy || presentPlayers.length === 0}
                  style={{ flex: 1 }}
                />
                <Button
                  label="🔀 Random"
                  variant="ghost"
                  onPress={() => assignOrder('random')}
                  disabled={busy || presentPlayers.length === 0}
                  style={{ flex: 1 }}
                />
                <Button
                  label="➡️ Arrival"
                  variant="ghost"
                  onPress={() => assignOrder('arrival')}
                  disabled={busy || arrivalSeq.length === 0}
                  style={{ flex: 1 }}
                />
              </View>

              {order.length > 0 && (
                <View style={{ marginTop: space.md, gap: 6 }}>
                  {order.map((pid, i) => (
                    <View key={pid} style={styles.orderRow}>
                      <Text style={styles.orderNum}>{i + 1}</Text>
                      <Text style={styles.orderName}>{playerName(pid)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <Button
              label="▶ Start practice"
              variant="success"
              onPress={startPractice}
              disabled={busy || order.length === 0}
            />
          </>
        )}

        {(session.status === 'LIVE' || session.status === 'COMPLETED') && (
          <>
            <View style={styles.segment}>
              <Pressable onPress={() => setMode('BAT')} style={[styles.segBtn, mode === 'BAT' && styles.segActive]}>
                <Text style={[styles.segText, mode === 'BAT' && styles.segTextActive]}>🏏 Batting</Text>
              </Pressable>
              <Pressable onPress={() => setMode('BOWL')} style={[styles.segBtn, mode === 'BOWL' && styles.segActive]}>
                <Text style={[styles.segText, mode === 'BOWL' && styles.segTextActive]}>🎯 Bowling</Text>
              </Pressable>
            </View>

            {mode === 'BAT' && (
              <>
            {session.status === 'LIVE' && currentId && (
              <Card style={{ borderColor: colors.green }}>
                <Text style={styles.hint}>Now batting</Text>
                <Text style={styles.currentName}>{playerName(currentId)}</Text>
                <CurrentLine line={bat[currentId] ?? emptyLine()} total={session.balls_per_batsman} penalty={session.out_penalty} />
                <View style={styles.scoreGrid}>
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <ScoreBtn key={r} label={String(r)} tone={r >= 4 ? colors.green : colors.primary} onPress={() => record(r, false)} />
                  ))}
                  <ScoreBtn label="OUT" tone={colors.red} wide onPress={() => record(0, true)} />
                  <ScoreBtn label="↩ Undo" tone={colors.textFaint} wide onPress={undo} />
                </View>
              </Card>
            )}

            {session.status === 'LIVE' && !currentId && (
              <Card style={{ borderColor: colors.amber }}>
                <Text style={[styles.cardTitle, { textAlign: 'center' }]}>All batters done 🎉</Text>
                <Button label="✅ Finish practice" variant="success" onPress={finish} style={{ marginTop: space.md }} />
              </Card>
            )}

            <Card>
              <Text style={styles.cardTitle}>Leaderboard (net score)</Text>
              <View style={[styles.lbRow, { borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 6 }]}>
                <Text style={[styles.lbCell, { flex: 2, color: colors.textDim }]}>Player</Text>
                <Text style={[styles.lbCell, { color: colors.textDim }]}>R(B)</Text>
                <Text style={[styles.lbCell, { color: colors.textDim }]}>Out</Text>
                <Text style={[styles.lbCell, { color: colors.textDim }]}>Net</Text>
              </View>
              {leaderboard.map((row, i) => {
                const isCurrent = row.pid === currentId && session.status === 'LIVE';
                return (
                  <Pressable
                    key={row.pid}
                    onPress={() => session.status === 'LIVE' && setCurrent(row.pid)}
                    style={[styles.lbRow, isCurrent && { backgroundColor: colors.greenDim, borderRadius: radius.sm }]}
                  >
                    <Text style={[styles.lbCell, { flex: 2, color: colors.text }]} numberOfLines={1}>
                      {i + 1}. {playerName(row.pid)}
                    </Text>
                    <Text style={[styles.lbCell, { color: colors.text }]}>
                      {row.runs}({row.balls_faced})
                    </Text>
                    <Text style={[styles.lbCell, { color: row.dismissals ? colors.red : colors.textFaint }]}>
                      {row.dismissals}
                    </Text>
                    <Text style={[styles.lbCell, { color: row.net >= 0 ? colors.green : colors.red, fontWeight: '800' }]}>
                      {row.net}
                    </Text>
                  </Pressable>
                );
              })}
              {session.status === 'LIVE' && <Text style={styles.hint}>Tap a player to switch who&apos;s batting.</Text>}
            </Card>
              </>
            )}

            {mode === 'BOWL' && (
              <BowlingTracker
                sessionId={session.id}
                bowlers={presentBowlers}
                initial={bowling}
                readOnly={session.status === 'COMPLETED'}
              />
            )}

            {session.status === 'LIVE' && <Button label="✅ Finish practice" variant="ghost" onPress={finish} />}
            {session.status === 'COMPLETED' && (
              <Button label="Re-open session" variant="ghost" onPress={reopen} />
            )}
          </>
        )}

        <Button label="← Back to sessions" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CurrentLine({ line, total, penalty }: { line: BatLine; total: number; penalty: number }) {
  const net = netScore(line.runs, line.dismissals, penalty);
  return (
    <View style={styles.currentStats}>
      <Stat label="Runs" value={line.runs} />
      <Stat label="Balls" value={`${line.balls_faced}/${total}`} />
      <Stat label="4s/6s" value={`${line.fours}/${line.sixes}`} />
      <Stat label="Outs" value={line.dismissals} tone={line.dismissals ? colors.red : undefined} />
      <Stat label="Net" value={net} tone={net >= 0 ? colors.green : colors.red} />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: tone ?? colors.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ScoreBtn({
  label,
  tone,
  onPress,
  wide,
}: {
  label: string;
  tone: string;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.scoreBtn,
        wide && { flexBasis: '47%' },
        { borderColor: tone, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={{ color: tone, fontSize: 20, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: -4 },
  statusChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.primaryDim },
  segText: { color: colors.textDim, fontWeight: '700', fontSize: 14 },
  segTextActive: { color: colors.text },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  attChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  orderNum: {
    color: colors.primary,
    fontWeight: '800',
    width: 24,
    textAlign: 'center',
    fontSize: 15,
  },
  orderName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  currentName: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  currentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.md,
    marginBottom: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  scoreBtn: {
    flexBasis: '30%',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
  },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4 },
  lbCell: { flex: 1, fontSize: 14, textAlign: 'center' },
});
