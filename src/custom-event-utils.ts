/** @internal */
type DefaultEventHandlers<T extends { type: string }> = {
  readonly [K in T['type']]: (this: unknown, event: CustomEvent<Extract<T, { type: K }>>) => void;
};

/**
 * Creates a function that dispatches a `CustomEvent` with the specified type and detail.
 *
 * You can narrow the type of `detail` by specifying a type parameter `TDetail`.
 *
 * @param eventTarget The EventTarget to dispatch the event on.
 * @returns A function that takes an event name and detail, and dispatches a `CustomEvent` with that detail.
 */
export const dispatchFunctionFromEventTarget =
  <TDetail extends { type: string }>(
    eventTarget: EventTarget,
  ): (<K extends TDetail['type']>(eventName: K, detail: Extract<TDetail, { type: K }>) => void) =>
  (eventName, detail) => {
    eventTarget.dispatchEvent(new CustomEvent<TDetail>(eventName, { detail: detail }));
  };

/**
 * Subscribes the specified handlers to the `EventTarget` for specific event types.
 * The handlers will be called with the event when the corresponding event is dispatched.
 *
 * @param handlers A dictionary of handlers where each key corresponds to an event type and each value is a function that handles that event.
 * @param eventTarget The EventTarget to subscribe the handlers to.
 * @returns A function that removes the event listeners when called.
 */
export const subscribeHandlersToEventTarget = <
  TDetail extends { type: string },
  THandlers extends DefaultEventHandlers<TDetail> = DefaultEventHandlers<TDetail>,
>(
  handlers: THandlers,
  eventTarget: EventTarget,
): (() => void) => {
  for (const key of Object.keys(handlers)) {
    eventTarget.addEventListener(key, handlers[key as keyof THandlers] as EventListener);
  }

  /**
   * Removes all event listeners that were added by this function.
   */
  return () => {
    for (const key of Object.keys(handlers)) {
      eventTarget.removeEventListener(key, handlers[key as keyof THandlers] as EventListener);
    }
  };
};
