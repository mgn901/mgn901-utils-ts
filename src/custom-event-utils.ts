/** @internal */
type DefaultEventHandlers<T extends { type: string }> = {
  readonly [K in T['type']]: (this: unknown, event: CustomEvent<Extract<T, { type: K }>>) => void;
};

export const dispatchFunctionFromEventTarget =
  <T extends { type: string }>(
    eventTarget: EventTarget,
  ): (<K extends T['type']>(eventName: K, detail: Extract<T, { type: K }>) => void) =>
  (eventName, detail) => {
    eventTarget.dispatchEvent(new CustomEvent<T>(eventName, { detail: detail }));
  };

export const subscribeHandlersToEventTarget = <
  T extends { type: string },
  THandlers extends DefaultEventHandlers<T> = DefaultEventHandlers<T>,
>(
  handlers: THandlers,
  eventTarget: EventTarget,
): (() => void) => {
  for (const key of Object.keys(handlers)) {
    eventTarget.addEventListener(key, handlers[key as keyof THandlers] as EventListener);
  }

  return () => {
    for (const key of Object.keys(handlers)) {
      eventTarget.removeEventListener(key, handlers[key as keyof THandlers] as EventListener);
    }
  };
};
