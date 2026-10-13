import { randomUUID } from 'node:crypto';

export function createCardCopy({ cardId } = {}) {
  if (typeof cardId !== 'string' || cardId.trim() === '') {
    throw new TypeError('A cardId is required for each physical copy');
  }

  return { cardId, copyId: randomUUID() };
}

export function prepareReprint(copy, { identity } = {}) {
  if (identity !== 'retain' && identity !== 'new') {
    throw new TypeError('Reprint identity must be explicitly "retain" or "new"');
  }
  if (!copy || typeof copy.cardId !== 'string' || typeof copy.copyId !== 'string') {
    throw new TypeError('A valid physical copy is required');
  }

  return identity === 'retain' ? { ...copy } : { ...copy, copyId: randomUUID() };
}
