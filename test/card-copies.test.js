import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCardCopy, prepareReprint } from '../src/card-copies.js';

test('each physical copy gets its own stable identity, including duplicate cards', () => {
  const first = createCardCopy({ cardId: 'oracle-sol-ring' });
  const second = createCardCopy({ cardId: 'oracle-sol-ring' });

  assert.equal(first.cardId, second.cardId);
  assert.notEqual(first.copyId, second.copyId);
  assert.match(first.copyId, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
});

test('an explicit retained reprint keeps the physical identity', () => {
  const original = createCardCopy({ cardId: 'oracle-sol-ring' });
  const reprint = prepareReprint(original, { identity: 'retain' });

  assert.equal(reprint.copyId, original.copyId);
  assert.equal(reprint.cardId, original.cardId);
});

test('a replacement or additional physical copy receives a new identity', () => {
  const original = createCardCopy({ cardId: 'oracle-sol-ring' });
  const replacement = prepareReprint(original, { identity: 'new' });

  assert.notEqual(replacement.copyId, original.copyId);
  assert.equal(replacement.cardId, original.cardId);
});

test('reprinting requires an explicit identity choice', () => {
  const original = createCardCopy({ cardId: 'oracle-sol-ring' });

  assert.throws(() => prepareReprint(original), /identity/i);
  assert.throws(() => prepareReprint(original, { identity: 'maybe' }), /identity/i);
});
