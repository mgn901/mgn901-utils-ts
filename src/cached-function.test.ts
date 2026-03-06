import { describe, expect, jest, test } from '@jest/globals';
import { cachedFunctionFrom, LruCacheStrategy } from './cached-function';

const func = (a: number): number => {
  return a ** a;
};

const cachedFuncFactory = () => {
  const mockedFunc = jest.fn(func);
  const cachedFunc = cachedFunctionFrom(mockedFunc, new LruCacheStrategy(3));
  return [mockedFunc, cachedFunc];
};

describe('cachedFunctionFrom', () => {
  test('cachedFunc should cache results when called with the same arguments', () => {
    const [mockedFunc, cachedFunc] = cachedFuncFactory();

    expect(cachedFunc(2)).toBe(4);
    expect(cachedFunc(2)).toBe(4); // from cache

    expect(mockedFunc).toHaveBeenCalledTimes(1);
  });

  test('cachedFunc should evict least recently used item when cache limit is exceeded', () => {
    const [mockedFunc, cachedFunc] = cachedFuncFactory();

    expect(cachedFunc(1)).toBe(1);
    expect(cachedFunc(2)).toBe(4);
    expect(cachedFunc(3)).toBe(27);
    expect(cachedFunc(4)).toBe(256); // 1 is evicted

    expect(cachedFunc(1)).toBe(1);

    expect(mockedFunc).toHaveBeenCalledTimes(5);
  });

  test('cachedFunc should reorder items in cache when accessed', () => {
    const [mockedFunc, cachedFunc] = cachedFuncFactory();

    expect(cachedFunc(1)).toBe(1);
    expect(cachedFunc(2)).toBe(4);
    expect(cachedFunc(3)).toBe(27);
    expect(cachedFunc(1)).toBe(1); // from cache
    expect(cachedFunc(4)).toBe(256); // 2 is evicted
    expect(cachedFunc(1)).toBe(1); // from cache

    expect(mockedFunc).toHaveBeenCalledTimes(4);
  });
});
