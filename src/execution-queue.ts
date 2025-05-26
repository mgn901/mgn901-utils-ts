import type { Client, Server } from './asyncify-events.js';
import type { NominalPrimitive } from './nominal-primitive.type.js';
import { bulkPreApply } from './pre-apply.js';
import { type Id, generateId } from './random-values.js';
import type { Filters, FromRepository, OrderBy } from './repository-utils.js';
import type { State } from './state.js';
import {
  type TimeWindowRateLimitationRule,
  calculateNextExecutionDate,
} from './time-window-rate-limitation.js';
import { executeAt } from './timer.js';
import type { TypedEventTarget } from './typed-event-target.js';

const executionTypeSymbol = Symbol('execution.type');

/**
 * Represents a unique identifier for an {@link Execution} entry in the queue.
 */
export type ExecutionId = NominalPrimitive<Id, typeof executionTypeSymbol>;

/**
 * Represents a single execution entry in the queue.
 * Contains execution id, arguments, scheduled execution date, and execution status.
 */
export type Execution<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = {
  readonly [executionTypeSymbol]: typeof executionTypeSymbol;
  readonly id: ExecutionId;
  readonly args: Readonly<TArgs>;
  readonly executedAt: Date;
  readonly isExecuted: boolean;
};

/**
 * Utility functions for creating and updating {@link Execution} objects.
 */
export const ExecutionReducers = {
  create: <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: Pick<Execution<TFunc, TArgs, TReturned>, 'args' | 'executedAt'>,
  ): Execution<TFunc, TArgs, TReturned> => {
    return {
      [executionTypeSymbol]: executionTypeSymbol,
      id: generateId() as ExecutionId,
      args: params.args,
      executedAt: params.executedAt,
      isExecuted: false,
    };
  },

  toExecuted: <
    S extends Execution<TFunc, TArgs, TReturned>,
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    self: S,
  ): S => ({ ...self, isExecuted: true }),

  toExecutionDateUpdated: <
    S extends Execution<TFunc, TArgs, TReturned>,
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    self: S,
    params: { readonly newExecutedAt: Date },
  ): S => ({ ...self, executedAt: params.newExecutedAt }),

  fromParams: <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: Omit<Execution<TFunc, TArgs, TReturned>, typeof executionTypeSymbol>,
  ) => ({ [executionTypeSymbol]: executionTypeSymbol, ...params }) as const,
};

/**
 * Represents events that occur in the execution queue, such as schedule changes or completion.
 */
export type ExecutionEvent<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> =
  | ExecutionScheduleChangeEvent<TFunc, TArgs, TReturned>
  | ExecutionCompleteEvent<TFunc, TArgs, TReturned>;

/**
 * Event fired when the execution schedule is changed.
 */
export class ExecutionScheduleChangeEvent<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> extends Event {
  public readonly type: 'scheduleChange';
  public readonly id: ExecutionId;
  public readonly args: Readonly<TArgs>;
  public readonly newSchedule: Date;

  public constructor(
    params: Pick<
      ExecutionScheduleChangeEvent<TFunc, TArgs, TReturned>,
      'id' | 'args' | 'newSchedule'
    >,
  ) {
    super('scheduleChange');
    this.type = 'scheduleChange';
    this.id = params.id;
    this.args = params.args;
    this.newSchedule = params.newSchedule;
  }
}

/**
 * Event fired when an execution is completed.
 */
export class ExecutionCompleteEvent<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> extends Event {
  public readonly type: 'complete';
  public readonly id: ExecutionId;
  public readonly args: Readonly<TArgs>;
  public readonly returned: TReturned;

  public constructor(
    params: Pick<ExecutionCompleteEvent<TFunc, TArgs, TReturned>, 'id' | 'args' | 'returned'>,
  ) {
    super('complete');
    this.type = 'complete';
    this.id = params.id;
    this.args = params.args;
    this.returned = params.returned;
  }
}

/**
 * Represents the state of the execution queue (idle or reserved).
 */
export type ExecutionQueueState =
  | {
      readonly status: 'reserved';
      readonly id: ExecutionId;
      readonly abortController: AbortController;
    }
  | { readonly status: 'idle' };

/**
 * Public interface for the execution queue gateway.
 * Provides methods to enqueue, cancel, and start the queue.
 */
export type ExecutionQueueGateway<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = {
  enqueue(
    this: unknown,
    params: { readonly args: Readonly<TArgs> },
  ): Promise<Execution<TFunc, TArgs, TReturned>>;

  cancel(this: unknown, params: { readonly id: ExecutionId }): Promise<void>;

  start(params: Record<never, never> & {}): void;
};

/**
 * Repository interface for persisting and retrieving execution entries.
 */
export type ExecutionRepository<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = {
  getOneById(
    this: ExecutionRepository<TFunc, TArgs, TReturned>,
    id: ExecutionId,
  ): Promise<FromRepository<Execution<TFunc, TArgs, TReturned>> | undefined>;

  getMany(
    this: ExecutionRepository<TFunc, TArgs, TReturned>,
    params: {
      readonly filters?: Filters<
        Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'> // `id`の型が不定なので取り除いている。以下同様。
      >;
      readonly orderBy: OrderBy<
        Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'>
      >;
      readonly offset?: number | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<readonly FromRepository<Execution<TFunc, TArgs, TReturned>>[] | readonly []>;

  count(
    this: ExecutionRepository<TFunc, TArgs, TReturned>,
    params: {
      readonly filters?: Filters<
        Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'>
      >;
    },
  ): Promise<number>;

  createOne(
    this: ExecutionRepository<TFunc, TArgs, TReturned>,
    execution: Execution<TFunc, TArgs, TReturned>,
  ): Promise<void>;

  updateOne(
    this: ExecutionRepository<TFunc, TArgs, TReturned>,
    execution: FromRepository<Execution<TFunc, TArgs, TReturned>>,
  ): Promise<void>;

  deleteOneById(this: ExecutionRepository<TFunc, TArgs, TReturned>, id: ExecutionId): Promise<void>;
};

//#region ExecutionQueueGateway
/**
 * Dependencies required for the execution queue gateway implementation.
 */
export type ExecutionQueueGatewayDependencies<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = {
  readonly strategy: ExecutionQueueStrategy<TFunc, TArgs, TReturned>;
  readonly executionQueueState: State<ExecutionQueueState>;
  readonly executionRepository: ExecutionRepository<TFunc, TArgs, TReturned>;
  readonly client: Client<Server<TFunc, TArgs, TReturned>, TArgs, TReturned, TFunc>;
  readonly executionEventTarget: TypedEventTarget<ExecutionEvent<TFunc, TArgs, TReturned>>;
  readonly reservationEventTarget: EventTarget;
};

/**
 * Main implementation of the {@linkcode ExecutionQueueGateway}.
 * Delegates operations to the provided strategy and dependencies.
 */
export const ExecutionQueueGatewayImplementation = {
  start: <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: ExecutionQueueGatewayDependencies<TFunc, TArgs, TReturned>,
  ): void => {
    params.strategy.handleStart(params);

    const handleEnqueue = () => params.strategy.handleEnqueue(params);
    const handleComplete = () => params.strategy.handleComplete(params);
    const handleCancel = () => params.strategy.handleCancel(params);
    params.reservationEventTarget.addEventListener('enqueue', handleEnqueue);
    params.reservationEventTarget.addEventListener('complete', handleComplete);
    params.reservationEventTarget.addEventListener('cancel', handleCancel);
  },

  enqueue: async <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: { readonly args: Readonly<TArgs> } & Pick<
      ExecutionQueueGatewayDependencies<TFunc, TArgs, TReturned>,
      'strategy' | 'executionRepository' | 'reservationEventTarget'
    >,
  ): Promise<Execution<TFunc, TArgs, TReturned>> => {
    const executedAt = await params.strategy.calculateExecutionDate({
      executionRepository: params.executionRepository,
    });
    const execution = ExecutionReducers.create({ args: params.args, executedAt });
    await params.executionRepository.createOne(execution);

    params.reservationEventTarget.dispatchEvent(new Event('enqueue'));

    return execution;
  },

  cancel: async <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: { readonly id: ExecutionId } & Pick<
      ExecutionQueueGatewayDependencies<TFunc, TArgs, TReturned>,
      'executionQueueState' | 'executionRepository' | 'reservationEventTarget'
    >,
  ): Promise<void> => {
    const currentState = params.executionQueueState.get();
    if (currentState.status === 'reserved' && params.id === currentState.id) {
      currentState.abortController.abort();
      params.executionQueueState.set({ status: 'idle' });
    }

    const execution = await params.executionRepository.getOneById(params.id);
    if (execution?.isExecuted === true) {
      return;
    }

    await params.executionRepository.deleteOneById(params.id);

    params.reservationEventTarget.dispatchEvent(new Event('cancel'));
  },
} as const;

/**
 * Create a pre-applied execution queue gateway with dependencies.
 *
 * ## Usage
 * ```ts
 * import { type ExecutionQueueState } from '@mgn901/mgn901-utils-ts/execution-queue';
 * import { createState } from '@mgn901/mgn901-utils-ts/state';
 *
 * // Declarations of `client` and `executionRepository` is omitted for brevity
 *
 * // Create a pre-applied ExecutionQueueGateway
 * const executionQueueGateway = createExecutionQueueGateway({
 *   client: client,
 *   executionQueueState: createState<ExecutionQueueState>({ status: 'idle' }),
 *   executionEventTarget: new EventTarget(),
 *   reservationEventTarget: new EventTarget(),
 *   executionRepository: executionRepository,
 *   strategy: createExecutionQueueTimeWindowRateLimitationStrategy({
 *     timeWindowRateLimitationRules: [
 *       { timeWindowMs: 5000, executionCountPerTimeWindow: 10 },
 *       { timeWindowMs: 10000, executionCountPerTimeWindow: 15 },
 *       { timeWindowMs: 20000, executionCountPerTimeWindow: 20 },
 *     ],
 *   }),
 * });
 *
 * // Start the ExecutionQueueGateway
 * executionQueueGateway.start({});
 *
 * // Enqueue a function calling
 * executionQueueGateway.enqueue({ args: [0] });
 * ```
 */
export const createExecutionQueueGateway = <
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
>(
  preAppliedParams: ExecutionQueueGatewayDependencies<TFunc, TArgs, TReturned>,
) =>
  bulkPreApply<
    ExecutionQueueGateway<TFunc, TArgs, TReturned>,
    ExecutionQueueGatewayDependencies<TFunc, TArgs, TReturned>
  >(ExecutionQueueGatewayImplementation, preAppliedParams);
//#endregion

/**
 * Parameters passed to strategy handlers for execution queue operations.
 */
export type ExecutionQueueStrategyHandlerParams<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = {
  readonly executionQueueState: State<ExecutionQueueState>;
  readonly executionRepository: ExecutionRepository<TFunc, TArgs, TReturned>;
  readonly client: Client<Server<TFunc, TArgs, TReturned>, TArgs, TReturned, TFunc>;
  readonly executionEventTarget: TypedEventTarget<ExecutionEvent<TFunc, TArgs, TReturned>>;
  readonly reservationEventTarget: EventTarget;
};

/**
 * Interface for pluggable execution queue strategies (e.g., scheduling, rate limiting).
 */
export type ExecutionQueueStrategy<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = {
  calculateExecutionDate(params: {
    readonly executionRepository: ExecutionRepository<TFunc, TArgs, TReturned>;
  }): Promise<Date>;

  handleEnqueue(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>,
  ): Promise<void>;

  handleComplete(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>,
  ): Promise<void>;

  handleCancel(params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>): Promise<void>;

  handleStart(params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>): Promise<void>;
};

/**
 * Dependencies for the {@linkcode ExecutionQueueTimeWindowRateLimitationStrategy}.
 */
export type ExecutionQueueTimeWindowRateLimitationStrategyDependencies = {
  readonly timeWindowRateLimitationRules: readonly TimeWindowRateLimitationRule[];
};

/**
 * Strategy implementation of {@linkcode ExecutionQueueStrategy} for time window rate limiting of executions.
 */
export const ExecutionQueueTimeWindowRateLimitationStrategy = {
  calculateExecutionDate<
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: {
      readonly executionRepository: ExecutionRepository<TFunc, TArgs, TReturned>;
    } & ExecutionQueueTimeWindowRateLimitationStrategyDependencies,
  ): Promise<Date> {
    return calculateNextExecutionDate({
      timeWindowRateLimitationRules: params.timeWindowRateLimitationRules,
      getNewestExecutionDateInLatestTimeWindow: async () =>
        (await params.executionRepository.getMany({ orderBy: { executedAt: 'desc' }, limit: 1 }))[0]
          ?.executedAt ?? new Date(),
      getOldestExecutionDateInLatestTimeWindow: async (startOfLastTimeWindow: Date) =>
        (
          await params.executionRepository.getMany({
            filters: { executedAt: { from: startOfLastTimeWindow } },
            orderBy: { executedAt: 'asc' },
            limit: 1,
          })
        )[0]?.executedAt,
      countExecutionsInLatestTimeWindow: (startOfLastTimeWindow: Date) =>
        params.executionRepository.count({
          filters: { executedAt: { from: startOfLastTimeWindow } },
        }),
    });
  },

  handleEnqueue: <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>,
  ): Promise<void> => {
    return ExecutionQueueTimeWindowRateLimitationStrategy.handleNext(params);
  },

  handleComplete: <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>,
  ): Promise<void> => {
    return ExecutionQueueTimeWindowRateLimitationStrategy.handleNext(params);
  },

  handleCancel: <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>,
  ): Promise<void> => {
    return ExecutionQueueTimeWindowRateLimitationStrategy.handleNext(params);
  },

  handleStart: async <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned> &
      ExecutionQueueTimeWindowRateLimitationStrategyDependencies,
  ): Promise<void> => {
    const waitingExecutions = await params.executionRepository.getMany({
      filters: { isExecuted: false },
      orderBy: { executedAt: 'asc' },
    });
    for (const execution of waitingExecutions) {
      const newExecutedAt =
        await ExecutionQueueTimeWindowRateLimitationStrategy.calculateExecutionDate({
          executionRepository: params.executionRepository,
          timeWindowRateLimitationRules: params.timeWindowRateLimitationRules,
        });
      const updatedExecution = ExecutionReducers.toExecutionDateUpdated<
        FromRepository<Execution<TFunc, TArgs, TReturned>>,
        TFunc,
        TArgs,
        TReturned
      >(execution, { newExecutedAt });
      params.executionRepository.updateOne(updatedExecution);
    }
    return ExecutionQueueTimeWindowRateLimitationStrategy.handleNext(params);
  },

  handleNext: async <
    TFunc extends (this: unknown, ...args: TArgs) => TReturned,
    TArgs extends unknown[] = Parameters<TFunc>,
    TReturned = ReturnType<TFunc>,
  >(
    params: ExecutionQueueStrategyHandlerParams<TFunc, TArgs, TReturned>,
  ): Promise<void> => {
    // すでに予約された実行がある場合は、何もしない。
    if (params.executionQueueState.get().status !== 'idle') {
      return;
    }

    // 次の実行待ちを取り出す。
    const [nextExecution] = await params.executionRepository.getMany({
      filters: { isExecuted: false },
      orderBy: { executedAt: 'asc' },
      limit: 1,
    });
    if (nextExecution === undefined) {
      return;
    }

    // 次の実行待ちを予約する。
    const abortController = new AbortController();
    params.executionQueueState.set({
      status: 'reserved',
      id: nextExecution.id,
      abortController: new AbortController(),
    });
    const executionDate = new Date(Math.max(nextExecution.executedAt.getTime(), Date.now()));

    executeAt({
      date: executionDate,
      func: async () => {
        const returned = await params.client.request(...nextExecution.args);
        await params.executionRepository.updateOne(
          ExecutionReducers.toExecuted<typeof nextExecution, TFunc, TArgs, TReturned>(
            nextExecution,
          ),
        );

        params.executionQueueState.set({ status: 'idle' });

        params.executionEventTarget.dispatchEvent(
          new ExecutionCompleteEvent<TFunc, TArgs, TReturned>({
            id: nextExecution.id,
            args: nextExecution.args,
            returned,
          }),
        );

        params.reservationEventTarget.dispatchEvent(new Event('complete'));
      },
      abortSignal: abortController.signal,
    });
  },
} as const;

/**
 * Create a pre-applied {@linkcode ExecutionQueueStrategy} for time window rate limiting.
 */
export const createExecutionQueueTimeWindowRateLimitationStrategy = <
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
>(
  preAppliedParams: ExecutionQueueTimeWindowRateLimitationStrategyDependencies,
) =>
  bulkPreApply<
    ExecutionQueueStrategy<TFunc, TArgs, TReturned>,
    ExecutionQueueTimeWindowRateLimitationStrategyDependencies
  >(ExecutionQueueTimeWindowRateLimitationStrategy, preAppliedParams);
