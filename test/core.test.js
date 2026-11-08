import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichError,
  getEnrichment,
  serializeError,
  deserializeError,
} from '../src/index.js';

test('enrichError attaches metadata without mutating the original error', () => {
  const original = new Error('boom');
  const enriched = enrichError(original, { requestId: 'abc', userId: 7 });

  assert.equal(original.requestId, undefined);
  assert.equal(original._enrichment, undefined);
  assert.equal(enriched.name, 'Error');
  assert.equal(enriched.message, 'boom');
  assert.equal(enriched._enrichment.requestId, 'abc');
  assert.equal(enriched._enrichment.userId, 7);
});

test('enrichError preserves the original stack string', () => {
  const original = new Error('with stack');
  const enriched = enrichError(original, { layer: 'db' });
  assert.equal(enriched.stack, original.stack);
});

test('enrichError merges metadata from an already enriched error', () => {
  const first = enrichError(new Error('first'), { a: 1 });
  const second = enrichError(new Error('second'), { b: 2 });
  const merged = enrichError(new Error('third'), getEnrichment(first));
  const combined = enrichError(new Error('fourth'), {
    ...getEnrichment(second),
    ...getEnrichment(merged),
  });

  assert.deepEqual(getEnrichment(combined), { a: 1, b: 2 });
});

test('enrichError rejects non-Error values', () => {
  assert.throws(() => enrichError('nope', {}), TypeError);
  assert.throws(() => enrichError(null, {}), TypeError);
});

test('enrichError rejects non-object metadata', () => {
  assert.throws(() => enrichError(new Error('x'), null), TypeError);
  assert.throws(() => enrichError(new Error('x'), []), TypeError);
  assert.throws(() => enrichError(new Error('x'), 'meta'), TypeError);
});

test('getEnrichment returns a copy, not the internal map', () => {
  const enriched = enrichError(new Error('copy'), { a: 1 });
  const copy = getEnrichment(enriched);
  copy.a = 999;
  assert.equal(getEnrichment(enriched).a, 1);
});

test('getEnrichment returns an empty object for plain errors', () => {
  assert.deepEqual(getEnrichment(new Error('plain')), {});
  assert.deepEqual(getEnrichment(null), {});
  assert.deepEqual(getEnrichment({}), {});
});

test('serializeError and deserializeError round-trip metadata', () => {
  const enriched = enrichError(new Error('round'), { code: 'E42', retry: false });
  const json = serializeError(enriched);
  const restored = deserializeError(json);

  assert.equal(restored.name, 'Error');
  assert.equal(restored.message, 'round');
  assert.deepEqual(restored._enrichment, { code: 'E42', retry: false });
});

test('deserializeError tolerates a missing enrichment key', () => {
  const restored = deserializeError(JSON.stringify({ name: 'Error', message: 'no meta' }));
  assert.deepEqual(restored._enrichment, {});
});

test('deserializeError rejects non-object JSON', () => {
  assert.throws(() => deserializeError('42'), TypeError);
  assert.throws(() => deserializeError('"str"'), TypeError);
  assert.throws(() => deserializeError('null'), TypeError);
  assert.throws(() => deserializeError('[1,2]'), TypeError);
});

test('serializeError rejects non-object input', () => {
  assert.throws(() => serializeError(null), TypeError);
  assert.throws(() => serializeError('x'), TypeError);
});

test('deserializeError rejects non-string input', () => {
  assert.throws(() => deserializeError({}), TypeError);
  assert.throws(() => deserializeError(123), TypeError);
});
