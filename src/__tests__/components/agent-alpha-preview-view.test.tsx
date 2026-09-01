import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewView } from '@/components/agent-alpha/views/preview-view';
import type { AgentAlphaPendingResults } from '@/lib/agent-alpha-types';

const buildFieldResult = (
  fieldKey: string,
  fieldName: string,
  overrides: Record<string, unknown> = {}
) => ({
  fieldKey,
  fieldName,
  initialAccuracy: 0.5,
  finalAccuracy: 0.9,
  finalPrompt: 'improved prompt',
  iterationCount: 2,
  improved: true,
  converged: false,
  sampledDocIds: ['doc1', 'doc2', 'doc3'],
  hasGroundTruth: true,
  finalAccuracyEvalSet: 'holdout',
  ...overrides,
});

const buildResults = (
  overrides: Partial<AgentAlphaPendingResults> = {}
): AgentAlphaPendingResults => ({
  runId: 'run-1',
  results: [buildFieldResult('good', 'Good Field')],
  timestamp: new Date().toISOString(),
  testModel: 'google__gemini_3_5_flash',
  sampledDocIds: ['doc1', 'doc2', 'doc3'],
  trainDocIds: ['doc1', 'doc2', 'doc3'],
  holdoutDocIds: ['doc4', 'doc5', 'doc6'],
  sampledDocNames: { doc1: 'One', doc2: 'Two', doc3: 'Three' },
  startTime: 1000,
  endTime: 2000,
  estimatedTimeMs: 1000,
  actualTimeMs: 1000,
  ...overrides,
});

describe('PreviewView failed-field reporting', () => {
  test('warns about fields that failed and shows the underlying error', () => {
    render(
      <PreviewView
        results={buildResults({
          failedFields: [
            { fieldKey: 'broken', fieldName: 'Broken Field', error: 'Box API returned 429' },
          ],
        })}
      />
    );

    expect(screen.getByText(/1 field failed and was not optimized/i)).toBeInTheDocument();
    expect(screen.getByText(/Broken Field/)).toBeInTheDocument();
    expect(screen.getByText(/Box API returned 429/)).toBeInTheDocument();
  });

  test('pluralizes and lists every failed field', () => {
    render(
      <PreviewView
        results={buildResults({
          failedFields: [
            { fieldKey: 'a', fieldName: 'Field A', error: 'timeout' },
            { fieldKey: 'b', fieldName: 'Field B', error: 'rate limited' },
          ],
        })}
      />
    );

    expect(screen.getByText(/2 fields failed and were not optimized/i)).toBeInTheDocument();
    expect(screen.getByText(/Field A/)).toBeInTheDocument();
    expect(screen.getByText(/Field B/)).toBeInTheDocument();
  });

  test('shows no warning when no fields failed', () => {
    render(<PreviewView results={buildResults({ failedFields: [] })} />);

    expect(screen.queryByText(/not optimized/i)).not.toBeInTheDocument();
  });

  // Results saved before failure tracking existed have no failedFields key.
  test('shows no warning when failedFields is absent', () => {
    render(<PreviewView results={buildResults()} />);

    expect(screen.queryByText(/not optimized/i)).not.toBeInTheDocument();
  });
});

describe('PreviewView accuracy provenance', () => {
  test('warns when a field could not be validated on held-out docs', () => {
    render(
      <PreviewView
        results={buildResults({
          results: [buildFieldResult('a', 'Contract Date', { finalAccuracyEvalSet: 'none' })],
        })}
      />
    );

    expect(
      screen.getByText(/1 field could not be validated on held-out documents/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/likely optimistic/i)).toBeInTheDocument();
    expect(screen.getByText('Unverified accuracy')).toBeInTheDocument();
  });

  test('names every unvalidated field', () => {
    render(
      <PreviewView
        results={buildResults({
          results: [
            buildFieldResult('a', 'Contract Date', { finalAccuracyEvalSet: 'none' }),
            buildFieldResult('b', 'Vendor Name', { finalAccuracyEvalSet: 'none' }),
          ],
        })}
      />
    );

    expect(
      screen.getByText(/2 fields could not be validated on held-out documents/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Contract Date, Vendor Name/)).toBeInTheDocument();
  });

  test('labels a clean holdout measurement without warning', () => {
    render(
      <PreviewView
        results={buildResults({
          results: [buildFieldResult('a', 'Contract Date', { finalAccuracyEvalSet: 'holdout' })],
        })}
      />
    );

    expect(screen.getByText('Verified on holdout docs')).toBeInTheDocument();
    expect(screen.queryByText(/could not be validated/i)).not.toBeInTheDocument();
  });

  test('flags a train-set score as measured on tuning docs', () => {
    render(
      <PreviewView
        results={buildResults({
          results: [buildFieldResult('a', 'Contract Date', { finalAccuracyEvalSet: 'train' })],
        })}
      />
    );

    expect(screen.getByText('Scored on tuning docs')).toBeInTheDocument();
    // 'train' is optimistic but not a validation failure, so no banner.
    expect(screen.queryByText(/could not be validated/i)).not.toBeInTheDocument();
  });

  // Fields without ground truth never get a held-out score, so 'none' is expected there.
  test('does not warn for fields that have no ground truth', () => {
    render(
      <PreviewView
        results={buildResults({
          results: [
            buildFieldResult('a', 'Freeform Notes', {
              finalAccuracyEvalSet: 'none',
              hasGroundTruth: false,
            }),
          ],
        })}
      />
    );

    expect(screen.queryByText(/could not be validated/i)).not.toBeInTheDocument();
  });

  // Legacy results predate this field; labelling them "unverified" would be a false alarm.
  test('stays silent when the eval set is unknown', () => {
    render(
      <PreviewView
        results={buildResults({
          results: [buildFieldResult('a', 'Contract Date', { finalAccuracyEvalSet: undefined })],
        })}
      />
    );

    expect(screen.queryByText(/could not be validated/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Unverified accuracy')).not.toBeInTheDocument();
    expect(screen.queryByText('Verified on holdout docs')).not.toBeInTheDocument();
  });
});
