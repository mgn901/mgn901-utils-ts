import { describe, expect, jest, test } from '@jest/globals';
import { ReactiveMap } from './reactive-map.js';

describe('ReactiveMap', () => {
  test('subscribeToEntry should register listeners in provided listenerMap', () => {
    const listenerMap = new Map<string, (() => void)[]>();
    const underlying = new Map<string, number>();
    const reactiveMap = new ReactiveMap(underlying, { listenerMap });

    const onChange1 = jest.fn();
    const onChange2 = jest.fn();
    const unsubscribe1 = reactiveMap.subscribeToEntry('key1', onChange1);
    const unsubscribe2 = reactiveMap.subscribeToEntry('key1', onChange2);

    const arr = listenerMap.get('key1') ?? [];
    expect(arr).toContain(onChange1);
    expect(arr).toContain(onChange2);
    expect(listenerMap.has('key2')).toBe(false);

    unsubscribe1();
    unsubscribe2();
  });

  test('changing map should call relevant listeners only and global listeners', () => {
    const listenerMap = new Map<string, (() => void)[]>();
    const underlying = new Map<string, number>();
    const reactiveMap = new ReactiveMap(underlying, { listenerMap });

    const a1 = jest.fn();
    const a2 = jest.fn();
    const b1 = jest.fn();
    const global = jest.fn();

    reactiveMap.subscribeToEntry('a', a1);
    reactiveMap.subscribeToEntry('a', a2);
    reactiveMap.subscribeToEntry('b', b1);
    reactiveMap.subscribe(global);

    // Changing map entry 'a'
    reactiveMap.set('a', 1);

    // Ensures only 'a' listeners and global listeners called
    expect(a1).toHaveBeenCalledTimes(1);
    expect(a2).toHaveBeenCalledTimes(1);
    expect(b1).not.toHaveBeenCalled();
    expect(global).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe() removes only target listener from listenerMap', () => {
    const listenerMap = new Map<string, (() => void)[]>();
    const underlying = new Map<string, number>();
    const reactiveMap = new ReactiveMap(underlying, { listenerMap });

    const a1 = jest.fn();
    const a2 = jest.fn();

    reactiveMap.subscribeToEntry('a', a1);
    const unsubscribeA2 = reactiveMap.subscribeToEntry('a', a2);

    // Ensures both registered
    expect(listenerMap.get('a')?.length).toBe(2);

    // Unsubscribe a2
    unsubscribeA2();

    // Ensures a2 removed, a1 still registered
    const listeners = listenerMap.get('a') ?? [];
    expect(listeners).toContain(a1);
    expect(listeners).not.toContain(a2);

    // Ensures other keys unaffected
    const b1 = jest.fn();
    reactiveMap.subscribeToEntry('b', b1);
    reactiveMap.set('b', 5);
    expect(b1).toHaveBeenCalledTimes(1);

    // Ensures only a1 receives a change to 'a'
    reactiveMap.set('a', 10);
    expect(a1).toHaveBeenCalledTimes(1);
    expect(a2).not.toHaveBeenCalled();
  });
});
