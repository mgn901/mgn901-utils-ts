import type { FieldsOf, OmitByValue, PickByValue } from './utils.type';

const latestVersion = Symbol('repository.latestVersion');

export const repositorySymbol = { latestVersion: latestVersion } as const;

export type LogicalFilter<TFilter> =
  | AndFilter<TFilter>
  | OrFilter<TFilter>
  | NotFilter<TFilter>;
export type AndFilter<TFilter> = [
  'and',
  ...(TFilter | LogicalFilter<TFilter>)[],
];
export type OrFilter<TFilter> = ['or', ...(TFilter | LogicalFilter<TFilter>)[]];
export type NotFilter<TFilter> = ['not', TFilter | LogicalFilter<TFilter>];
export type NumberFilter<T extends number | Date> =
  | T
  | ['gt' | 'lt' | 'gte' | 'lte', T];
export type StringFilter<T extends string> =
  | T
  | ['gt' | 'lt' | 'gte' | 'lte', T]
  | ['startsWith' | 'contains' | 'endsWith', string];
export type Filters<T> =
  | OmitByValue<
      {
        readonly [K in keyof FieldsOf<T>]?: NonNullable<T[K]> extends boolean
          ? T[K]
          : NonNullable<T[K]> extends number | Date
            ?
                | LogicalFilter<NumberFilter<NonNullable<T[K]>>>
                | NumberFilter<NonNullable<T[K]>>
            : NonNullable<T[K]> extends string
              ?
                  | LogicalFilter<StringFilter<NonNullable<T[K]>>>
                  | StringFilter<NonNullable<T[K]>>
              : never;
      },
      never
    >
  | undefined;

type OrderByBase<T> = {
  readonly [K in keyof PickByValue<FieldsOf<T>, string | number | Date>]:
    | 'asc'
    | 'desc';
};

export type OrderBy<T> = {
  readonly [K in keyof PickByValue<FieldsOf<T>, string | number | Date>]: {
    readonly [Ka in K]: OrderByBase<T>[Ka];
  } & Partial<OrderByBase<T>>;
}[keyof PickByValue<FieldsOf<T>, string | number | Date>];

export type FromRepository<T> = T & { readonly [latestVersion]: T };
