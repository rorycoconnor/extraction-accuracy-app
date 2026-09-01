/**
 * Prompt-search helpers for Agent Alpha: pick among rewrite candidates
 * by measured accuracy, never by "looks detailed."
 */

export type ScoredPrompt = {
  prompt: string;
  accuracy: number;
};

export function isSimpleExtractionPrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  return trimmed.length < 100 || trimmed.toLowerCase().startsWith('extract the ');
}

export function uniquePrompts(prompts: string[], currentPrompt?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const prompt of prompts) {
    const normalized = prompt.trim();
    if (!normalized) continue;
    if (currentPrompt !== undefined && normalized === currentPrompt.trim()) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/**
 * Keep the current prompt unless a candidate strictly beats it.
 * Generic starter prompts ("Extract the X") may be replaced on a tie
 * so a real extraction instruction can land.
 */
export function pickBestCandidate(args: {
  current: ScoredPrompt;
  candidates: ScoredPrompt[];
}): { winner: ScoredPrompt; improved: boolean } {
  const { current, candidates } = args;
  const allowTieReplace = isSimpleExtractionPrompt(current.prompt);

  let best = current;
  for (const candidate of candidates) {
    if (!candidate.prompt.trim()) continue;
    if (candidate.accuracy > best.accuracy) {
      best = candidate;
      continue;
    }
    if (
      candidate.accuracy === best.accuracy &&
      allowTieReplace &&
      best.prompt === current.prompt &&
      candidate.prompt.trim() !== current.prompt.trim()
    ) {
      best = candidate;
    }
  }

  const improved =
    best.prompt.trim() !== current.prompt.trim() &&
    (best.accuracy > current.accuracy || (allowTieReplace && best.accuracy >= current.accuracy));

  return {
    winner: improved ? best : current,
    improved,
  };
}
