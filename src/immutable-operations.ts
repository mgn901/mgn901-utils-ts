export const toAdded = <T>(
  ...args:
    | [array: readonly T[], index: number, value: T]
    | [array: readonly T[], value: T]
): T[] => [
  ...args[0].slice(0, args.length === 3 ? args[1] : -1),
  args.length === 3 ? args[2] : args[1],
  ...(args.length === 3 ? args[0].slice(args[1] + 1) : []),
];

export const toSet = <T>(array: readonly T[], index: number, value: T): T[] => [
  ...array.slice(0, index),
  value,
  ...array.slice(index + 1),
];

export const toDeleted = <T>(array: readonly T[], index: number): T[] => [
  ...array.slice(0, index),
  ...array.slice(index + 1),
];
