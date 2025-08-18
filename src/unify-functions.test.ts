import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { divideFunction, unifyFunctions } from './unify-functions.js';

describe('unify-functions', () => {
  const add = jest.fn((a: number, b: number, c: number) => a + b + c);
  const subtract = jest.fn((a: number, b: number) => a - b);
  const functions = { add, subtract };

  const unifiedFunction = unifyFunctions(functions);
  const dividedFunctions = divideFunction<typeof functions>(unifiedFunction, ['add', 'subtract']);

  test('unified function should call the correct function based on key', () => {
    const addResult = unifiedFunction({ key: 'add', args: [1, 2, 3] });
    const subtractResult = unifiedFunction({ key: 'subtract', args: [1, 2] });

    expect(addResult).toBe(6);
    // Ensures that `add` was called with the correct parameters.
    expect(add).toHaveBeenCalledWith(1, 2, 3);
    // Ensures that `add` was called exactly once.
    expect(add).toHaveBeenCalledTimes(1);

    expect(subtractResult).toBe(-1);
    expect(subtract).toHaveBeenCalledWith(1, 2);
    expect(subtract).toHaveBeenCalledTimes(1);
  });

  test('divided function should call the correct function based on key', () => {
    const addResult = dividedFunctions.add(1, 2, 3);
    const subtractResult = dividedFunctions.subtract(1, 2);

    expect(addResult).toBe(6);
    // Ensures that `add` was called with the correct parameters.
    expect(add).toHaveBeenCalledWith(1, 2, 3);
    // Ensures that `add` was called exactly once.
    expect(add).toHaveBeenCalledTimes(1);

    expect(subtractResult).toBe(-1);
    expect(subtract).toHaveBeenCalledWith(1, 2);
    expect(subtract).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
