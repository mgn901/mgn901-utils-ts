const head = Symbol('head');
const tail = Symbol('tail');
const comparator = Symbol('comparator');
const getEntryByKey = Symbol('getEntryByKey');
const getIndexAndEntryByValue = Symbol('getEntryByValue');
const deleteEntry = Symbol('deleteEntry');

const defaultComparator = <T>(a: T, b: T) => a === b;

/**
 * A Map-like ordered collection where keys are numeric indices (positions).
 *
 * This interface extends the ES `Map<number, T>` API with convenience
 * position-based operations. Keys are interpreted as zero-based indices for
 * `get`/`set`/`delete`.
 */
export interface TotalOrderedMap<T> extends Map<number, T> {
  /**
   * Returns boolean indicating whether `value` exists or not.
   */
  hasValue(value: T): boolean;

  /**
   * Insert `value` at `key` (index). If `key` > size, it will be clamped to
   * size.
   */
  insert(key: number, value: T): this;

  /**
   * Append `value` to the end.
   */
  insert(value: T): this;

  /**
   * Returns the index of the first occurrence of `value` in the map, or -1 if
   * it is not present.
   */
  indexOf(value: T): number;

  /**
   * Delete the first occurrence of `value`. Returns true if an element in the
   * Map existed and has been removed, or false if the element does not exist.
   */
  deleteValue(value: T): boolean;
}

/**
 * Internal doubly-linked list node. Not exported.
 */
interface ListEntry<T> {
  prev: ListEntry<T> | undefined;
  value: T;
  next: ListEntry<T> | undefined;
}

/**
 * A minimal ordered collection backed by a doubly-linked list. It implements
 * the `TotalOrderedMap<T>` interface which behaves similarly to an array of
 * values with stable insert/delete semantics and O(n) positional access.
 */
export class LinkedTotalOrderedMap<T> implements TotalOrderedMap<T> {
  // This implementation intentionally exposes only the public API; internal list
  // pointers (`head`, `tail`, `prev`, `next`) are private.
  private [head]: ListEntry<T> | undefined;
  private [tail]: ListEntry<T> | undefined;
  private [comparator]: (this: unknown, a: T, b: T) => boolean;
  size: number;

  /**
   * Find the list node for a zero-based `key` (index).
   * Traverses from the head or tail depending on which is closer.
   */
  private [getEntryByKey](key: number): ListEntry<T> | undefined {
    if (
      key >= this.size ||
      this[head] === undefined ||
      this[tail] === undefined
    )
      return undefined;

    if (key < this.size / 2) {
      let entry = this[head];
      // biome-ignore lint/style/noNonNullAssertion: all entries until `key` are chained
      for (let i = 1; i <= key; i++) entry = entry.next!;
      return entry;
    } else {
      let entry = this[tail];
      // biome-ignore lint/style/noNonNullAssertion: all entries until `key` are chained
      for (let i = this.size - 2; i >= key; i--) entry = entry.prev!;
      return entry;
    }
  }

  /**
   * Find the first list node whose `value` equals `value` and return a tuple of
   * its zero-based index and the node. Returns `undefined` if not found.
   */
  private [getIndexAndEntryByValue](
    value: T,
  ): [number, ListEntry<T>] | undefined {
    let entry = this[head];
    let i = 0;
    while (
      entry !== undefined &&
      entry.next !== undefined &&
      this[comparator](entry.value, value) === false
    ) {
      entry = entry.next;
      i++;
    }
    return entry !== undefined && this[comparator](entry.value, value)
      ? [i, entry]
      : undefined;
  }

  /**
   * Remove a node from the list and fix surrounding pointers. This function
   * also updates `head`/`tail` and decrements `size`.
   */
  private [deleteEntry](entry: ListEntry<T> | undefined): boolean {
    if (entry === undefined) return false;

    if (entry.prev) entry.prev.next = entry.next;
    if (entry.next) entry.next.prev = entry.prev;

    if (entry.prev === undefined) this[head] = entry.next;
    if (entry.next === undefined) this[tail] = entry.prev;

    entry.prev = undefined;
    entry.next = undefined;

    this.size -= 1;

    return true;
  }

  /**
   * Create a new LinkedTotalOrderedMap. If `iterable` is provided the values
   * are appended in order.
   */
  constructor(
    iterable?: readonly T[] | Iterable<T> | null,
    compare?: (this: unknown, a: T, b: T) => boolean,
  ) {
    this.size = 0;
    if (Array.isArray(iterable)) {
      for (let i = 0; i < iterable?.length; i++) {
        this.insert(iterable[i]);
      }
    } else if (iterable) {
      for (const item of iterable) {
        this.insert(item);
      }
    }
    this[comparator] = compare ?? defaultComparator;
  }

  insert(key: number, value: T): this;
  insert(value: T): this;
  /**
   * Insert overloads: either `insert(index, value)` or `insert(value)` to
   * append. If `index` is larger than the current size it will be clamped to
   * the current size (append).
   */
  insert(...args: [number, T] | [T]): this {
    const [key, value] =
      args.length === 2
        ? [Math.min(this.size, args[0]), args[1]]
        : [this.size, args[0]];

    const prev = key === 0 ? undefined : this[getEntryByKey](key - 1);
    const next = this[getEntryByKey](key);
    const entry = { prev, value, next };
    if (prev) prev.next = entry;
    if (next) next.prev = entry;

    if (key === 0) this[head] = entry;
    if (key === this.size) this[tail] = entry;

    this.size++;

    return this;
  }

  clear(): void {
    this[head] = undefined;
    this[tail] = undefined;
    this.size = 0;
  }

  delete(key: number): boolean {
    const entry = this[getEntryByKey](key);
    return this[deleteEntry](entry);
  }

  entries(): MapIterator<[number, T]> {
    return new LinkedTotalOrderedMapEntryIterator(this[head]);
  }

  forEach(
    callbackfn: (value: T, key: number, map: Map<number, T>) => void,
    thisArg?: unknown,
  ): void {
    const iterator = new LinkedTotalOrderedMapEntryIterator(this[head]);
    for (const [key, value] of iterator)
      callbackfn.call(thisArg, value, key, this);
  }

  get(key: number): T | undefined {
    return this[getEntryByKey](key)?.value;
  }

  has(key: number): boolean {
    return this[getEntryByKey](key) !== undefined;
  }

  keys(): MapIterator<number> {
    return new LinkedTotalOrderedMapKeyIterator(this[head]);
  }

  /**
   * Adds a new element with a specified key and value to the Map. If an element
   * with the same key already exists, the element will be updated.
   *
   * Note: if `key` > size, it will be clamped to size (append).
   */
  set(key: number, value: T): this {
    const entry = this[getEntryByKey](key);
    if (entry === undefined) this.insert(value);
    else entry.value = value;
    return this;
  }

  values(): MapIterator<T> {
    return new LinkedTotalOrderedMapValueIterator(this[head]);
  }

  [Symbol.iterator](): MapIterator<[number, T]> {
    return new LinkedTotalOrderedMapEntryIterator(this[head]);
  }

  get [Symbol.toStringTag]() {
    return 'LinkedTotalOrderedMap';
  }

  hasValue(value: T): boolean {
    return this[getIndexAndEntryByValue](value) !== undefined;
  }

  indexOf(value: T): number {
    return this[getIndexAndEntryByValue](value)?.[0] ?? -1;
  }

  deleteValue(value: T): boolean {
    const entry = this[getIndexAndEntryByValue](value)?.[1] ?? undefined;
    return this[deleteEntry](entry);
  }
}

/**
 * Base iterator implementation used by the various Map iterators. Provides
 * no-op `return`/`throw` and iterable protocol support.
 */
abstract class MapIteratorBase<T, RT> {
  protected currentEntry: ListEntry<T> | undefined;
  constructor(head: ListEntry<T> | undefined) {
    this.currentEntry = head;
  }
  return(value?: undefined): IteratorResult<RT, undefined> {
    this.currentEntry = undefined;
    return { value, done: true };
  }

  throw(_e?: unknown): IteratorResult<RT, undefined> {
    this.currentEntry = undefined;
    return { value: undefined, done: true };
  }

  [Symbol.iterator](): this {
    return this;
  }
  [Symbol.dispose](): void {
    this.currentEntry = undefined;
  }
}

class LinkedTotalOrderedMapEntryIterator<T>
  extends MapIteratorBase<T, [number, T]>
  implements MapIterator<[number, T]>
{
  private index: number = 0;
  next(...[_value]: [] | [unknown]): IteratorResult<[number, T], undefined> {
    const entry = this.currentEntry;
    const key = this.index;
    if (entry === undefined) return { value: undefined, done: true };
    this.currentEntry = entry.next;
    this.index++;
    return { value: [key, entry.value], done: false };
  }
}

class LinkedTotalOrderedMapKeyIterator<T>
  extends MapIteratorBase<T, number>
  implements MapIterator<number>
{
  private index: number = 0;
  next(...[_value]: [] | [unknown]): IteratorResult<number, undefined> {
    const entry = this.currentEntry;
    const key = this.index;
    if (entry === undefined) return { value: undefined, done: true };
    this.currentEntry = entry.next;
    this.index++;
    return { value: key, done: false };
  }
}

class LinkedTotalOrderedMapValueIterator<T>
  extends MapIteratorBase<T, T>
  implements MapIterator<T>
{
  next(...[_value]: [] | [unknown]): IteratorResult<T, undefined> {
    const entry = this.currentEntry;
    if (entry === undefined) return { value: undefined, done: true };
    this.currentEntry = entry.next;
    return { value: entry.value, done: false };
  }
}
