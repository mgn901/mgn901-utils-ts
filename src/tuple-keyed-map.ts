import { LinkedTotalOrderedMap } from './total-ordered-map';

const getNode = Symbol('getNode');
const makeNode = Symbol('makeNode');
const deleteNode = Symbol('deleteNode');
const rootNodeKey = Symbol('rootNodeKey');

/**
 * A Map implementation that uses tuple keys.
 *
 * In standard `Map`, keys are compared by reference, so two different arrays
 * with the same contents would be considered different keys. `TupleKeyedMap`
 * treats arrays as tuples and compares them by value, so two different arrays
 * with the same contents would be considered the same key.
 */
export class TupleKeyedMap<
  K extends readonly unknown[],
  V extends Exclude<unknown, undefined>,
> implements Map<K, V>
{
  private root = new TreeNode<K[number], V | undefined>(
    undefined,
    rootNodeKey,
    undefined,
  );
  private nodeToValueMap = new Map<TreeNode<K[number], V | undefined>, V>();
  size: number = 0;

  /**
   * Get a node for the given tuple key.
   */
  [getNode](tupleKey: K): TreeNode<K[number], V | undefined> | undefined {
    let node: TreeNode<K[number], V | undefined> | undefined = this.root;
    for (let i = 0; i < tupleKey.length && node !== undefined; i++) {
      const tupleElement = tupleKey[i];
      node = node.getChild(tupleElement);
    }
    return node;
  }

  /**
   * Create a new node for the given tuple key.
   * If a node already exists for the tuple key, return it.
   */
  [makeNode](tupleKey: K): TreeNode<K[number], V | undefined> {
    let node = this.root;
    for (let i = 0; i < tupleKey.length; i++) {
      const tupleElement = tupleKey[i];
      node =
        node.getChild(tupleElement) ?? node.setChild(tupleElement, undefined);
    }
    return node;
  }

  /**
   * Delete `node` from the tree and if its parent has no value and children,
   * prune it.
   */
  [deleteNode](node: TreeNode<K[number], V | undefined>): void {
    let currentNode = node;
    while (
      currentNode.parent !== undefined &&
      currentNode.value === undefined &&
      currentNode.childNodeCount === 0
    ) {
      const parent = currentNode.parent;
      parent.deleteChild(currentNode.key);
      currentNode.parent = undefined;

      currentNode = parent;
    }
  }

  constructor(
    iterable?: readonly (readonly [K, V])[] | Iterable<readonly [K, V]> | null,
  ) {
    if (Array.isArray(iterable))
      for (let i = 0; i < iterable?.length; i++)
        this.set(...(iterable[i] as readonly [K, V]));
    else if (iterable) for (const item of iterable) this.set(...item);
  }

  clear(): void {
    this.root = new TreeNode(undefined, rootNodeKey, undefined);
    this.nodeToValueMap.clear();
    this.size = 0;
  }

  delete(key: K): boolean {
    const node = this[getNode](key);
    const exists = node !== undefined && node.value !== undefined;
    if (!exists) return false;
    node.value = undefined;
    this.nodeToValueMap.delete(node);
    this.size--;
    this[deleteNode](node);
    return true;
  }

  entries(): MapIterator<[K, V]> {
    return new TupleKeyedMapEntryIterator(this.nodeToValueMap);
  }

  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of new TupleKeyedMapEntryIterator(
      this.nodeToValueMap,
    ))
      callbackfn.call(thisArg, value, key, this);
  }

  get(key: K): V | undefined {
    const node = this[getNode](key);
    return node?.value;
  }

  has(key: K): boolean {
    return this[getNode](key)?.value !== undefined;
  }

  keys(): MapIterator<K> {
    return new TupleKeyedMapKeyIterator(this.nodeToValueMap);
  }

  set(key: K, value: V): this {
    const node = this[makeNode](key);
    const exists = node.value !== undefined;
    node.value = value;
    this.nodeToValueMap.set(node, value);
    if (!exists) this.size++;
    return this;
  }

  values(): MapIterator<V> {
    return new TupleKeyedMapValueIterator(this.nodeToValueMap);
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return new TupleKeyedMapEntryIterator(this.nodeToValueMap);
  }

  get [Symbol.toStringTag]() {
    return 'TupleKeyedMap';
  }
}

class TreeNode<K, V> {
  private children = new Map<K, TreeNode<K, V>>();
  parent: TreeNode<K, V> | undefined;
  readonly key: K | typeof rootNodeKey;
  value: V;
  constructor(parent: TreeNode<K, V> | undefined, key: K, value: V) {
    this.parent = parent;
    this.key = key;
    this.value = value;
  }
  getChild(key: K): TreeNode<K, V> | undefined {
    return this.children.get(key);
  }
  setChild(key: K, value: V): TreeNode<K, V> {
    const node = this.children.get(key) ?? new TreeNode(this, key, value);
    node.value = value;
    this.children.set(key, node);
    return node;
  }
  deleteChild(key: K): boolean {
    return this.children.delete(key);
  }
  get childNodeCount(): number {
    return this.children.size;
  }
}

const leafToTuple = <K extends readonly unknown[], V>(
  leaf: TreeNode<K[number], V>,
): K => {
  const list = new LinkedTotalOrderedMap<K[number]>();
  let currentNode = leaf;
  while (currentNode.parent !== undefined) {
    list.insert(0, currentNode.key);
    currentNode = currentNode.parent;
  }
  return Array.from(list.values()) as unknown as K;
};

abstract class TupleKeyedMapIteratorBase<
  K extends readonly unknown[],
  V extends Exclude<unknown, undefined>,
  RT,
> {
  protected iterator:
    | MapIterator<[TreeNode<K[number], V | undefined>, V]>
    | undefined;
  constructor(nodeToValueMap: Map<TreeNode<K[number], V | undefined>, V>) {
    this.iterator = nodeToValueMap[Symbol.iterator]();
  }
  [Symbol.iterator](): this {
    return this;
  }
  return(_value?: undefined): IteratorResult<RT, undefined> {
    return { value: undefined, done: true };
  }
  throw(_e?: unknown): IteratorResult<RT, undefined> {
    return { value: undefined, done: true };
  }
  [Symbol.dispose](): void {
    this.iterator = undefined;
  }
}

class TupleKeyedMapEntryIterator<
    K extends readonly unknown[],
    V extends Exclude<unknown, undefined>,
  >
  extends TupleKeyedMapIteratorBase<K, V, [K, V]>
  implements MapIterator<[K, V]>
{
  next(...[_value]: [] | [unknown]): IteratorResult<[K, V], undefined> {
    if (this.iterator === undefined) return { value: undefined, done: true };
    const result = this.iterator.next();
    if (result.done === false)
      return {
        value: [leafToTuple(result.value[0]), result.value[1]],
        done: false,
      };
    return { value: undefined, done: true };
  }
}

class TupleKeyedMapKeyIterator<
    K extends readonly unknown[],
    V extends Exclude<unknown, undefined>,
  >
  extends TupleKeyedMapIteratorBase<K, V, K>
  implements MapIterator<K>
{
  next(...[_value]: [] | [unknown]): IteratorResult<K, undefined> {
    if (this.iterator === undefined) return { value: undefined, done: true };
    const result = this.iterator.next();
    if (result.done === false)
      return { value: leafToTuple(result.value[0]), done: false };
    return { value: undefined, done: true };
  }
}

class TupleKeyedMapValueIterator<
    K extends readonly unknown[],
    V extends Exclude<unknown, undefined>,
  >
  extends TupleKeyedMapIteratorBase<K, V, V>
  implements MapIterator<V>
{
  next(...[_value]: [] | [unknown]): IteratorResult<V, undefined> {
    if (this.iterator === undefined) return { value: undefined, done: true };
    const result = this.iterator.next();
    if (result.done === false) return { value: result.value[1], done: false };
    return { value: undefined, done: true };
  }
}
