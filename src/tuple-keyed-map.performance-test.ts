import { argv, memoryUsage } from 'node:process';
import { TupleKeyedMap } from './tuple-keyed-map.js';

const COUNT = 100_000;
const MAX_TUPLE_LENGTH = 1;
const MAX_INNER_OBJ_SIZE = 1;

export class StringifiedTupleKeyedMap<K, V> implements Map<K, V> {
  private readonly map = new Map<string, V>();

  clear(): void {
    this.map.clear();
  }
  delete(key: K): boolean {
    return this.map.delete(JSON.stringify(key));
  }
  entries(): MapIterator<[K, V]> {
    const iterator = this.map.entries();
    return {
      [Symbol.iterator]() {
        return this;
      },
      [Symbol.dispose]() {},
      next(): IteratorResult<[K, V]> {
        const result = iterator.next();
        if (result.done) return { done: true, value: undefined };
        const [key, value] = result.value;
        return { done: false, value: [JSON.parse(key), value] };
      },
    };
  }
  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown,
  ): void {
    const iterator = this.map.entries();
    for (const [key, value] of iterator) {
      callbackfn.call(thisArg, value, JSON.parse(key), this);
    }
  }
  get(key: K): V | undefined {
    return this.map.get(JSON.stringify(key));
  }
  has(key: K): boolean {
    return this.map.has(JSON.stringify(key));
  }
  keys(): MapIterator<K> {
    const iterator = this.map.keys();
    return {
      [Symbol.iterator]() {
        return this;
      },
      [Symbol.dispose]() {},
      next(): IteratorResult<K> {
        const result = iterator.next();
        if (result.done) return { done: true, value: undefined };
        const key = result.value;
        return { done: false, value: JSON.parse(key) };
      },
    };
  }
  set(key: K, value: V): this {
    this.map.set(JSON.stringify(key), value);
    return this;
  }
  get size(): number {
    return this.map.size;
  }
  values(): MapIterator<V> {
    return this.map.values();
  }
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }
  get [Symbol.toStringTag]() {
    return 'StringifiedTupleKeyedMap';
  }
}

// test data
const entries: [number[][], number][] = [];
for (let i = 0; i < COUNT; i++) {
  const key = Array.from(
    { length: Math.floor(Math.random() * MAX_TUPLE_LENGTH) },
    () =>
      Array.from(
        { length: Math.floor(Math.random() * MAX_INNER_OBJ_SIZE) },
        () => Math.floor(Math.random() * 2 ** 53),
      ),
  );
  entries.push([key, i]);
}

const ops = Array(COUNT)
  .fill(0)
  .map(() => Math.random());

// test by passing `stringifiedTupleKeyedMap` and `tupleKeyedMap` to this function and logging the results.
const runMapPerformanceTest = (
  map: Map<number[][], number>,
  entries: [number[][], number][],
  ops: number[],
): { time: number; heapTotal: number } => {
  const heapTotalOnStart = memoryUsage().heapTotal;
  const startedAt = globalThis.performance.now();

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const [key, value] = entries[i];

    if (op < 0.4) map.set(key, value);
    else if (op < 0.8) map.get(key);
    else map.delete(key);
  }

  const endedAt = globalThis.performance.now();
  const heapTotalOnEnd = memoryUsage().heapTotal;

  return {
    time: endedAt - startedAt,
    heapTotal: heapTotalOnEnd - heapTotalOnStart,
  };
};

if (argv[1] === import.meta.filename) {
  // NOTE: If you want to measure the memory performance, you should comment out
  // one of the tests to prevent interference from the other test's memory usage.

  const stringifiedTupleKeyedMap = new StringifiedTupleKeyedMap<
    number[][],
    number
  >();
  const {
    time: stringifiedTupleKeyedMapTime,
    heapTotal: stringifiedTupleKeyedMapHeapTotal,
  } = runMapPerformanceTest(stringifiedTupleKeyedMap, entries, ops);
  console.log(
    `StringifiedTupleKeyedMap: ${stringifiedTupleKeyedMapTime} ms, ${stringifiedTupleKeyedMapHeapTotal} B`,
  );

  const tupleKeyedMap = new TupleKeyedMap<number[][], number>();
  const { time: tupleKeyedMapTime, heapTotal: tupleKeyedMapHeapTotal } =
    runMapPerformanceTest(tupleKeyedMap, entries, ops);
  console.log(
    `TupleKeyedMap: ${tupleKeyedMapTime} ms, ${tupleKeyedMapHeapTotal} B`,
  );
}
