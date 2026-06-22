// Custom practice scoring + fair batting-order logic.

/**
 * Net practice score for a batter in one session.
 * Positive runs, minus a configurable penalty for every dismissal.
 *   net = runs - dismissals * outPenalty
 */
export function netScore(runs: number, dismissals: number, outPenalty: number): number {
  return runs - dismissals * outPenalty;
}

export interface FairOrderInput {
  playerId: string;
  /**
   * Average batting position this player has historically been given
   * (1 = opened, higher = batted lower). null when they have no history.
   */
  avgHistoricalOrder: number | null;
  /** Stable per-shuffle random in [0,1) — caller supplies so logic stays testable. */
  rand: number;
}

/**
 * Produce a batting order that is randomized but balanced "with equal preference":
 * players who have historically batted LOWER (bigger avgHistoricalOrder) are
 * nudged toward the top this time, so over many sessions everyone gets a fair
 * share of opening slots. Players with no history are treated as neutral and
 * rely on the random component.
 *
 * Returns playerIds in batting order (index 0 = first to bat).
 */
export function fairBattingOrder(players: FairOrderInput[]): string[] {
  const n = players.length;
  if (n === 0) return [];

  const withHistory = players.filter((p) => p.avgHistoricalOrder != null);
  // Neutral baseline = middle of the order.
  const neutral = (n + 1) / 2;
  const avg =
    withHistory.length > 0
      ? withHistory.reduce((s, p) => s + (p.avgHistoricalOrder as number), 0) / withHistory.length
      : neutral;

  // 70% fairness pull, 30% randomness — enough shuffle to feel fresh each time
  // without erasing the balancing effect.
  const FAIRNESS = 0.7;
  const RANDOM = 0.3;

  return players
    .map((p) => {
      const hist = p.avgHistoricalOrder ?? avg;
      // Higher score => earlier slot. Batted-low-before => high (hist - avg) => earlier now.
      const fairness = (hist - avg) / Math.max(1, n);
      const score = FAIRNESS * fairness + RANDOM * (p.rand - 0.5);
      return { id: p.playerId, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

/** Plain Fisher–Yates shuffle for "pure random" order. `rands` supplies randomness. */
export function shuffleOrder(playerIds: string[], rands: number[]): string[] {
  const arr = [...playerIds];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((rands[i] ?? Math.random()) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
