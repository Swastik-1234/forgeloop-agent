// Groq's free tier caps usage at 8000 tokens/minute account-wide. Reactively
// retrying after a 429 works but wastes a full request and still bursts past
// the limit first. This tracks actual token usage in a rolling 60s window
// (recorded from each response's real usage, not an estimate) and, before
// issuing a new call, waits if a rough estimate of that call's cost would
// push the window over budget — so most calls avoid the 429 in the first
// place instead of hitting it and backing off.

const WINDOW_MS = 60_000;
const TOKEN_BUDGET = 8000;
const SAFETY_MARGIN = 500; // stay a bit under the real cap

interface UsageEntry {
  timestamp: number;
  tokens: number;
}

const usageLog: UsageEntry[] = [];

function pruneOldEntries(now: number) {
  while (usageLog.length > 0 && usageLog[0]!.timestamp < now - WINDOW_MS) {
    usageLog.shift();
  }
}

function tokensUsedInWindow(now: number): number {
  pruneOldEntries(now);
  return usageLog.reduce((sum, entry) => sum + entry.tokens, 0);
}

// Rough token estimate for pre-call budgeting: ~4 chars/token is a standard
// approximation for English/code text, good enough for pacing decisions.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function recordUsage(tokens: number) {
  usageLog.push({ timestamp: Date.now(), tokens });
}

export async function waitForBudget(
  estimatedTokens: number,
  onWait?: (waitMs: number) => void
): Promise<void> {
  const now = Date.now();
  const used = tokensUsedInWindow(now);

  if (used + estimatedTokens <= TOKEN_BUDGET - SAFETY_MARGIN) {
    return;
  }

  // Wait until the oldest entry in the window ages out, freeing up budget.
  const oldest = usageLog[0];
  const waitMs = oldest ? Math.max(oldest.timestamp + WINDOW_MS - now, 1000) : 5000;
  onWait?.(waitMs);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}
