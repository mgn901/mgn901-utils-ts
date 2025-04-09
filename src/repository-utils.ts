import type { FieldsOf, OmitByValue, PickByValue } from './utils.type';

const latestVersion = Symbol('repository.latestVersion');

export const repositorySymbol = {
  latestVersion: latestVersion,
} as const;

export type Filters<T> =
  | OmitByValue<
      {
        readonly [K in keyof FieldsOf<T>]?: NonNullable<T[K]> extends boolean
          ? T[K] | undefined
          : NonNullable<T[K]> extends number | Date
            ? T[K] | { readonly from?: T[K]; readonly until?: T[K] }
            : NonNullable<T[K]> extends string
              ?
                  | T[K]
                  | {
                      readonly from?: T[K];
                      readonly until?: T[K];
                      readonly startsWith?: string;
                      readonly contains?: string;
                      readonly endsWith?: string;
                    }
              : never;
      },
      never
    >
  | undefined;

type OrderByBase<T> = {
  readonly [K in keyof PickByValue<FieldsOf<T>, string | number | Date>]: 'asc' | 'desc';
};

export type OrderBy<T> = {
  readonly [K in keyof PickByValue<FieldsOf<T>, string | number | Date>]: {
    readonly [Ka in K]: OrderByBase<T>[Ka];
  } & Partial<OrderByBase<T>>;
}[keyof PickByValue<FieldsOf<T>, string | number | Date>];

export type FromRepository<T> = T & { readonly [latestVersion]: T };
