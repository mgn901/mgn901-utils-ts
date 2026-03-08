import { describe, expect, test } from '@jest/globals';
import { TupleKeyedMap } from './tuple-keyed-map.js';
import { StringifiedTupleKeyedMap } from './tuple-keyed-map.performance-test.js';

describe('TupleKeyedMap', () => {
  test('set() with new key should inserts new entry', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    expect(map.get(['n'])).toBeUndefined();

    map.set(['n'], 7);

    expect(map.get(['n'])).toBe(7);
    expect(map.size).toBe(1);
  });

  test('set() with new key should increments the map size', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    expect(map.size).toBe(0);

    map.set(['a'], 1);
    map.set(['b'], 2);

    expect(map.size).toBe(2);
  });

  test('set() with existing key updates value but does not change the map size', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['x'], 1);
    const before = map.size;

    map.set(['x'], 5);

    expect(map.size).toBe(before);
    expect(map.get(['x'])).toBe(5);
  });

  test('delete() of existing key should remove the entry, decrements the map size and return true', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['d'], 9);
    const before = map.size;

    const res = map.delete(['d']);

    expect(res).toBe(true);
    expect(map.size).toBe(before - 1);
    expect(map.get(['d'])).toBeUndefined();
  });

  test('delete() of non-existing key should do nothing, keep the map size unchanged and return false', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['e'], 1);
    const before = map.size;

    const res = map.delete(['z']);

    expect(res).toBe(false);
    expect(map.size).toBe(before);
  });

  test('clear() should remove all entries and reset the map size to 0', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['a'], 1).set(['b'], 2);
    expect(map.size).toBe(2);

    map.clear();

    expect(map.size).toBe(0);
    expect(Array.from(map.entries()).length).toBe(0);
  });

  test('[Symbol.iterator]() should return an iterator over all entries in the map', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['one'], 1).set(['two'], 2);

    const iterated = Array.from(map[Symbol.iterator]());

    expect(iterated).toEqual([
      [['one'], 1],
      [['two'], 2],
    ]);
  });

  test('entries() should return an iterator over all entries in the map', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['k1'], 10).set(['k2'], 20);

    const entries = Array.from(map.entries());

    expect(entries).toEqual([
      [['k1'], 10],
      [['k2'], 20],
    ]);
  });

  test('keys() should return an iterator over all keys in the map', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['a'], 1).set(['b'], 2);

    const keys = Array.from(map.keys());

    expect(keys).toEqual([['a'], ['b']]);
  });

  test('values() should return an iterator over all values in the map', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['a'], 1).set(['b'], 2);

    const values = Array.from(map.values());

    expect(values).toEqual([1, 2]);
  });

  test('forEach() should iterate over all entries in the map and call the callback with correct arguments (includes thisArg)', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['x'], 1).set(['y'], 2);
    const calls: Array<[number, readonly unknown[]]> = [];
    const thisArg = { tag: 'ctx' };

    map.forEach(function (this: unknown, value, key, m) {
      expect(this).toBe(thisArg);
      expect(m).toBe(map);
      calls.push([value, key]);
    }, thisArg);

    expect(calls).toEqual([
      [1, ['x']],
      [2, ['y']],
    ]);
  });

  test('prefix delete should only delete the entry with the exact key and not any other entry with a key that has the deleted key as a prefix', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['a'], 1);
    map.set(['a', 'b'], 2);
    expect(map.size).toBe(2);

    const res = map.delete(['a']);

    expect(res).toBe(true);
    expect(map.get(['a'])).toBeUndefined();
    expect(map.get(['a', 'b'])).toBe(2);
    expect(map.size).toBe(1);
  });

  test('postfix delete should only delete the entry with the exact key and not any other entry', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    map.set(['p', 'q'], 5);
    map.set(['p'], 7);

    const res = map.delete(['p', 'q']);

    expect(res).toBe(true);
    expect(map.get(['p', 'q'])).toBeUndefined();
    expect(map.get(['p'])).toBe(7);
  });

  test('constructor with initial entries should populate the map correctly', () => {
    const map = new TupleKeyedMap([
      [['i1'], 1],
      [['i2'], 2],
    ]);

    expect(map.size).toBe(2);
    expect(map.get(['i1'])).toBe(1);
    expect(map.get(['i2'])).toBe(2);
  });

  test('set() / has() / get() / delete() with empty tuple key should work correctly', () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();

    expect(map.has([])).toBe(false);

    map.set([], 99);

    expect(map.has([])).toBe(true);
    expect(map.get([])).toBe(99);
    expect(map.delete([])).toBe(true);
    expect(map.has([])).toBe(false);
  });

  test('set() / has() / get() / delete() with tuple key which contains objects should work correctly', () => {
    const map = new TupleKeyedMap<readonly unknown[], string>();
    const o = { v: 1 };

    expect(map.has([o])).toBe(false);

    map.set([o], 'val');

    expect(map.has([o])).toBe(true);
    expect(map.get([o])).toBe('val');
    // different but structurally equal object should not match
    expect(map.get([{ v: 1 }])).toBeUndefined();
    expect(map.delete([o])).toBe(true);
    expect(map.has([o])).toBe(false);
  });

  test("toString() should return '[object TupleKeyedMap]'", () => {
    const map = new TupleKeyedMap<readonly unknown[], number>();
    expect(Object.prototype.toString.call(map)).toBe('[object TupleKeyedMap]');
  });
});

describe('TupleKeyedMap parity with StringifiedTupleKeyedMap', () => {
  test('set() should behave the same as StringifiedTupleKeyedMap.set()', () => {
    const ops = [
      [['a'], 1],
      [['b'], 2],
      [['a'], 3],
      [['c', 'd'], 4],
    ] as const;
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();

    for (const [k, v] of ops) {
      tMap.set(k, v);
      sMap.set(k, v);
    }

    expect(tMap.size).toBe(sMap.size);
    expect(Array.from(tMap.entries())).toEqual(Array.from(sMap.entries()));
  });

  test('has() should behave the same as StringifiedTupleKeyedMap.set()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['x'], 1);
    sMap.set(['x'], 1);

    expect(tMap.has(['x'])).toBe(sMap.has(['x']));
    expect(tMap.has(['y'])).toBe(sMap.has(['y']));
  });

  test('get() should behave the same as StringifiedTupleKeyedMap.set()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['g'], 42);
    sMap.set(['g'], 42);

    expect(tMap.get(['g'])).toBe(sMap.get(['g']));
    expect(tMap.get(['nope'])).toBe(sMap.get(['nope']));
  });

  test('delete() should behave the same as StringifiedTupleKeyedMap.delete()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['d1'], 1);
    sMap.set(['d1'], 1);

    const r1 = tMap.delete(['d1']);
    const r2 = sMap.delete(['d1']);

    expect(r1).toBe(r2);
    expect(tMap.size).toBe(sMap.size);
  });

  test('clear() should behave the same as StringifiedTupleKeyedMap.clear()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['a'], 1).set(['b'], 2);
    sMap.set(['a'], 1).set(['b'], 2);

    tMap.clear();
    sMap.clear();

    expect(tMap.size).toBe(sMap.size);
    expect(Array.from(tMap.entries())).toEqual(Array.from(sMap.entries()));
  });

  test('[Symbol.iterator]() should behave the same as StringifiedTupleKeyedMap[Symbol.iterator]()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['i'], 1).set(['j'], 2);
    sMap.set(['i'], 1).set(['j'], 2);

    expect(Array.from(tMap[Symbol.iterator]())).toEqual(
      Array.from(sMap[Symbol.iterator]()),
    );
  });

  test('entries() should behave the same as StringifiedTupleKeyedMap.entries()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['e1'], 1).set(['e2'], 2);
    sMap.set(['e1'], 1).set(['e2'], 2);

    expect(Array.from(tMap.entries())).toEqual(Array.from(sMap.entries()));
  });

  test('keys() should behave the same as StringifiedTupleKeyedMap.keys()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['k1'], 1).set(['k2'], 2);
    sMap.set(['k1'], 1).set(['k2'], 2);

    expect(Array.from(tMap.keys())).toEqual(Array.from(sMap.keys()));
  });

  test('values() should behave the same as StringifiedTupleKeyedMap.values()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['v1'], 1).set(['v2'], 2);
    sMap.set(['v1'], 1).set(['v2'], 2);

    expect(Array.from(tMap.values())).toEqual(Array.from(sMap.values()));
  });

  test('forEach() should behave the same as StringifiedTupleKeyedMap.forEach()', () => {
    const tMap = new TupleKeyedMap<readonly unknown[], number>();
    const sMap = new StringifiedTupleKeyedMap<readonly unknown[], number>();
    tMap.set(['f1'], 1).set(['f2'], 2);
    sMap.set(['f1'], 1).set(['f2'], 2);

    const tCalls: Array<[number, readonly unknown[]]> = [];
    const sCalls: Array<[number, readonly unknown[]]> = [];
    const thisArg = { tag: 'ctx' };

    tMap.forEach(function (this: unknown, v, k) {
      expect(this).toBe(thisArg);
      tCalls.push([v, k]);
    }, thisArg);
    sMap.forEach(function (this: unknown, v, k) {
      expect(this).toBe(thisArg);
      sCalls.push([v, k]);
    }, thisArg);

    expect(tCalls).toEqual(sCalls);
  });
});
