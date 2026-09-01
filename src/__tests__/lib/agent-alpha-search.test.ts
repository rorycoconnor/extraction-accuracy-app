import { describe, expect, test } from 'vitest';
import {
  isSimpleExtractionPrompt,
  pickBestCandidate,
  uniquePrompts,
} from '@/lib/agent-alpha-search';
import { seededShuffle, splitTrainHoldout } from '@/lib/agent-alpha-sampling';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';

describe('pickBestCandidate', () => {
  test('keeps the current prompt on a tie', () => {
    const current = { prompt: 'Search for the effective date in the header. Look for "effective as of". Return YYYY-MM-DD. Return Not Present if not found.', accuracy: 0.8 };
    const picked = pickBestCandidate({
      current,
      candidates: [{ prompt: 'A different detailed prompt with location and synonyms and format and disambiguation and not found.', accuracy: 0.8 }],
    });
    expect(picked.improved).toBe(false);
    expect(picked.winner.prompt).toBe(current.prompt);
  });

  test('selects a candidate that strictly beats the current prompt', () => {
    const current = { prompt: 'Search for the vendor name in the letterhead.', accuracy: 0.5 };
    const winner = { prompt: 'Look in the invoice header for the supplier legal name.', accuracy: 0.75 };
    const picked = pickBestCandidate({
      current,
      candidates: [
        { prompt: 'Worse rewrite', accuracy: 0.4 },
        winner,
      ],
    });
    expect(picked.improved).toBe(true);
    expect(picked.winner.prompt).toBe(winner.prompt);
  });

  test('replaces a generic starter prompt on a tie', () => {
    const picked = pickBestCandidate({
      current: { prompt: 'Extract the Effective Date', accuracy: 0.9 },
      candidates: [{ prompt: 'Search the header for effective as of and return YYYY-MM-DD.', accuracy: 0.9 }],
    });
    expect(picked.improved).toBe(true);
    expect(isSimpleExtractionPrompt('Extract the Effective Date')).toBe(true);
  });
});

describe('uniquePrompts', () => {
  test('drops blanks, duplicates, and the current prompt', () => {
    expect(
      uniquePrompts(
        [' Keep me ', 'Keep me', '', 'Extract the Date', 'other'],
        'Extract the Date'
      )
    ).toEqual(['Keep me', 'other']);
  });
});

describe('splitTrainHoldout strategies', () => {
  test('tail holdout is the end of the list', () => {
    const split = splitTrainHoldout(['1', '2', '3', '4', '5'], 0.2, 'tail');
    expect(split.holdoutDocIds).toEqual(['5']);
    expect(split.trainDocIds).toEqual(['1', '2', '3', '4']);
  });

  test('shuffled split is deterministic and partitions all ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const first = splitTrainHoldout(ids, 0.2, 'shuffled');
    const second = splitTrainHoldout(ids, 0.2, 'shuffled');
    expect(first).toEqual(second);
    expect(first.holdoutDocIds.length).toBe(2);
    expect([...first.trainDocIds, ...first.holdoutDocIds].sort()).toEqual([...ids].sort());
    expect(first.trainDocIds.some((id) => first.holdoutDocIds.includes(id))).toBe(false);
  });

  test('seededShuffle is stable and changes order', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
    expect(seededShuffle(items, 42).join('')).not.toBe(items.join(''));
  });
});

describe('Agent Alpha search config', () => {
  test('samples more than the old 8-doc cap and searches multiple candidates', () => {
    expect(AGENT_ALPHA_CONFIG.MAX_DOCS).toBeGreaterThanOrEqual(16);
    expect(AGENT_ALPHA_CONFIG.CANDIDATE_COUNT).toBe(3);
  });
});
