import {
  LinkedTotalOrderedMap,
  type TotalOrderedMap,
} from './total-ordered-map';
import { TupleKeyedMap } from './tuple-keyed-map';

export const cachedFunctionFrom = <A extends unknown[], R>(
  func: (this: unknown, ...args: A) => R,
  cacheStrategy: CacheStrategy<A, R>,
): ((this: unknown, ...args: A) => R) => {
  const calculateKey = calculateKeyFactory<A>(cacheStrategy.limit);
  const cache = new WithCacheStrategy<A, R>(new Map(), cacheStrategy);
  return (...args: A) => {
    const key = calculateKey(...args);
    const cacheExists = cache.get(key);
    if (cacheExists) return cacheExists;
    const result = func(...args);
    cache.set(key, result);
    return result;
  };
};

export interface CacheStrategy<K, V> {
  limit: number;
  touch(key: K, map: Map<K, V>): void;
  delete(key: K): void;
  clear(): void;
}

export class LruCacheStrategy<K, V> implements CacheStrategy<K, V> {
  private _limit: number;
  private cacheKeys: TotalOrderedMap<K>;
  constructor(
    limit: number,
    compare?: (this: unknown, a: unknown, b: unknown) => boolean,
  ) {
    this._limit = limit;
    this.cacheKeys = new LinkedTotalOrderedMap(undefined, compare);
  }
  get limit(): number {
    return this._limit;
  }
  touch(key: K, map: Map<K, V>): void {
    this.cacheKeys.deleteValue(key);
    this.cacheKeys.insert(0, key);
    if (this.cacheKeys.size > this._limit) {
      // biome-ignore lint/style/noNonNullAssertion: last item of the cacheKeys
      const deletedKey = this.cacheKeys.get(this.cacheKeys.size - 1)!;
      this.cacheKeys.delete(this.cacheKeys.size - 1);
      map.delete(deletedKey);
    }
  }
  delete(key: K): void {
    this.cacheKeys.deleteValue(key);
  }
  clear(): void {
    this.cacheKeys.clear();
  }
}

const compareTuple = (a: unknown, b: unknown): boolean => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const calculateKeyFactory = <A extends unknown[]>(
  limit: number,
): ((...args: A) => A) => {
  const keys = new WithCacheStrategy(
    new TupleKeyedMap<A, A>(),
    new LruCacheStrategy(limit, compareTuple),
  );

  return (...args: A): A => {
    const keyExists = keys.get(args);
    const key = keyExists ?? args;
    keys.set(key, key);
    return key;
  };
};

class WithCacheStrategy<K, V> implements Map<K, V> {
  private readonly strategy: CacheStrategy<K, V>;
  private readonly baseMap: Map<K, V>;

  constructor(baseMap: Map<K, V>, strategy: CacheStrategy<K, V>) {
    this.strategy = strategy;
    this.baseMap = baseMap;
  }
  clear(): void {
    this.strategy.clear();
    this.baseMap.clear();
  }
  delete(key: K): boolean {
    this.strategy.delete(key);
    return this.baseMap.delete(key);
  }
  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.baseMap.forEach(callbackfn, thisArg);
  }
  get(key: K): V | undefined {
    this.strategy.touch(key, this.baseMap);
    return this.baseMap.get(key);
  }
  has(key: K): boolean {
    return this.baseMap.has(key);
  }
  set(key: K, value: V): this {
    this.strategy.touch(key, this.baseMap);
    this.baseMap.set(key, value);
    return this;
  }
  get size(): number {
    return this.baseMap.size;
  }
  entries(): MapIterator<[K, V]> {
    return this.baseMap.entries();
  }
  keys(): MapIterator<K> {
    return this.baseMap.keys();
  }
  values(): MapIterator<V> {
    return this.baseMap.values();
  }
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.baseMap[Symbol.iterator]();
  }
  get [Symbol.toStringTag]() {
    return 'MapWithCacheStrategy';
  }
}
