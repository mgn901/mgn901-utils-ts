export type State<T> = {
  get(this: unknown): T;
  set(this: unknown, value: T): void;
};

export const createState = <T>(initialValue: T): State<T> => {
  let stateValue = initialValue;

  return {
    get: () => stateValue,
    set: (value: T) => {
      stateValue = value;
    },
  } as const;
};
