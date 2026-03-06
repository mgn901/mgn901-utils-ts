import { afterEach, describe, expect, jest, test } from '@jest/globals';
import {
  dispatchFunctionFromEventTarget,
  subscribeHandlersToEventTarget,
} from './custom-event-utils.js';

type CustomEventData =
  | { readonly type: 'add'; readonly a: number; readonly b: number }
  | { readonly type: 'subtract'; readonly c: number; readonly d: number };
const handleAdd = jest.fn();
const handleSubtract = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

describe('custom-event-utils', () => {
  test('dispatchFunction should dispatch CustomEvent with correct detail', async () => {
    const eventTarget = new EventTarget();
    eventTarget.addEventListener('add', handleAdd);
    eventTarget.addEventListener('subtract', handleSubtract);

    const dispatch =
      dispatchFunctionFromEventTarget<CustomEventData>(eventTarget);
    dispatch('add', { type: 'add', a: 1, b: 2 });
    dispatch('subtract', { type: 'subtract', c: 1, d: 2 });

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'add',
        detail: { type: 'add', a: 1, b: 2 },
      }),
    );
    expect(handleSubtract).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subtract',
        detail: { type: 'subtract', c: 1, d: 2 },
      }),
    );
  });

  test('subscribeHandlersToEventTarget should add and remove event listeners', () => {
    const eventTarget = new EventTarget();

    const unsubscribe = subscribeHandlersToEventTarget<CustomEventData>(
      { add: handleAdd, subtract: handleSubtract },
      eventTarget,
    );
    eventTarget.dispatchEvent(
      new CustomEvent('add', { detail: { type: 'add', a: 1, b: 2 } }),
    );
    eventTarget.dispatchEvent(
      new CustomEvent('subtract', { detail: { type: 'subtract', c: 1, d: 2 } }),
    );

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'add',
        detail: { type: 'add', a: 1, b: 2 },
      }),
    );
    expect(handleSubtract).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subtract',
        detail: { type: 'subtract', c: 1, d: 2 },
      }),
    );

    unsubscribe();
    eventTarget.dispatchEvent(
      new CustomEvent<CustomEventData>('add', {
        detail: { type: 'add', a: 2, b: 3 },
      }),
    );

    // Should not be called again after unsubscribe
    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleSubtract).toHaveBeenCalledTimes(1);
  });
});
