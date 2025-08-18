/** @internal */
type DefaultEventHandlers<T extends { type: string }> = {
  readonly [K in T['type']]: (this: unknown, event: CustomEvent<Extract<T, { type: K }>>) => void;
};

export const dispatchFunctionFromEventTarget =
  <TDetail extends { type: string }>(
    eventTarget: EventTarget,
  ): (<K extends TDetail['type']>(eventName: K, detail: Extract<TDetail, { type: K }>) => void) =>
  (eventName, detail) => {
    eventTarget.dispatchEvent(new CustomEvent<TDetail>(eventName, { detail: detail }));
  };

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

  return () => {
    for (const key of Object.keys(handlers)) {
      eventTarget.removeEventListener(key, handlers[key as keyof THandlers] as EventListener);
    }
  };
};
