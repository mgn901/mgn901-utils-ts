export class TypedEventTarget<TEvent extends Event> extends EventTarget {
  public addEventListener(
    this: TypedEventTarget<TEvent>,
    type: TEvent['type'],
    callback: TypedEventListener<TEvent> | TypedEventListenerObject<TEvent> | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    super.addEventListener(type, callback, options);
  }

  public dispatchEvent(this: TypedEventTarget<TEvent>, event: TEvent): boolean {
    return super.dispatchEvent(event);
  }

  public removeEventListener(
    this: TypedEventTarget<TEvent>,
    type: TEvent['type'],
    callback: TypedEventListener<TEvent> | TypedEventListenerObject<TEvent> | null,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type, callback, options);
  }
}

export interface TypedEventListener<TEvent extends Event> extends EventListener {
  (this: unknown, event: TEvent): void;
}

export interface TypedEventListenerObject<TEvent extends Event> extends EventListener {
  handleEvent(this: unknown, event: TEvent): void;
}
