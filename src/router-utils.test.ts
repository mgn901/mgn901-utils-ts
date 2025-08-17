import { describe, expect, jest, test } from '@jest/globals';
import { defineRouter } from './router-utils.js';

describe('router-utils', () => {
  const add = jest.fn((params: { type: 'add'; a: number; b: number }) => params.a + params.b);
  const subtract = jest.fn(
    (params: { type: 'subtract'; c: number; d: number }) => params.c - params.d,
  );
  const handlers = { add, subtract };

  test('router should call the correct handler based on typeKey', () => {
    const router = defineRouter(handlers, 'type');

    const addResult = router({ type: 'add', a: 1, b: 2 });
    const subtractResult = router({ type: 'subtract', c: 1, d: 2 });

    expect(addResult).toBe(3);
    // Ensures that `add` was called with the correct parameters.
    expect(add).toHaveBeenCalledWith({ type: 'add', a: 1, b: 2 });
    // Ensures that `add` was called exactly once.
    expect(add).toHaveBeenCalledTimes(1);

    expect(subtractResult).toBe(-1);
    expect(subtract).toHaveBeenCalledWith({ type: 'subtract', c: 1, d: 2 });
    expect(subtract).toHaveBeenCalledTimes(1);
  });
});
