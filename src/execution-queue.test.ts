import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { Client, EventTargetTerminal, Server } from './asyncify-events.js';
import {
  type Execution,
  type ExecutionEvent,
  type ExecutionId,
  type ExecutionQueueState,
  type ExecutionRepository,
  createExecutionQueueGateway,
  createExecutionQueueTimeWindowRateLimitationStrategy,
} from './execution-queue.js';
import {
  type Filters,
  type FromRepository,
  type OrderBy,
  repositorySymbol,
} from './repository-utils.js';
import { createState } from './state.js';
import type { TypedEventTarget } from './typed-event-target.js';

class ExecutionRepositoryMock<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends never[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> implements ExecutionRepository<TFunc, TArgs, TReturned>
{
  public readonly underlyingMap = new Map<ExecutionId, Execution<TFunc, TArgs, TReturned>>();

  public async getOneById(
    id: ExecutionId,
  ): Promise<FromRepository<Execution<TFunc, TArgs, TReturned>> | undefined> {
    const latestVersion = this.underlyingMap.get(id);
    if (latestVersion === undefined) {
      return undefined;
    }
    return { ...latestVersion, [repositorySymbol.latestVersion]: latestVersion };
  }

  public async getMany(params: {
    readonly filters?: Filters<
      Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'>
    >;
    readonly orderBy: OrderBy<
      Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'>
    >;
    readonly offset?: number | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly FromRepository<Execution<TFunc, TArgs, TReturned>>[] | readonly []> {
    return (await this.getExecutionsBase(params))
      .sort(
        (a, b) =>
          (params.orderBy.executedAt === 'asc' ? 1 : -1) *
          (a.executedAt.getTime() - b.executedAt.getTime()),
      )
      .slice(
        params.offset ?? 0,
        params.limit !== undefined ? (params.offset ?? 0) + params.limit : undefined,
      )
      .map((item) => ({ ...item, [repositorySymbol.latestVersion]: item }));
  }

  public async count(params: {
    readonly filters?: Filters<
      Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'>
    >;
  }): Promise<number> {
    return (await this.getExecutionsBase(params)).length;
  }

  private async getExecutionsBase(params: {
    readonly filters?: Filters<
      Pick<Execution<TFunc, TArgs, TReturned>, 'executedAt' | 'isExecuted'>
    >;
  }): Promise<Execution<TFunc, TArgs, TReturned>[]> {
    return [...this.underlyingMap.entries()]
      .filter(([_, execution]) => {
        const conditions = [
          params.filters?.executedAt instanceof Date === false ||
            execution.executedAt.getTime() === params.filters.executedAt.getTime(),

          params.filters?.executedAt instanceof Date === true ||
            params.filters?.executedAt?.from === undefined ||
            params.filters.executedAt.from <= execution.executedAt,

          params.filters?.executedAt instanceof Date === true ||
            params.filters?.executedAt?.until === undefined ||
            execution.executedAt <= params.filters.executedAt.until,

          params.filters?.isExecuted === undefined ||
            execution.isExecuted === params.filters.isExecuted,
        ];

        return !conditions.some((condition) => condition === false);
      })
      .map(([_, execution]) => execution);
  }

  public async createOne(execution: Execution<TFunc, TArgs, TReturned>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async updateOne(execution: Execution<TFunc, TArgs, TReturned>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async deleteOneById(id: ExecutionId): Promise<void> {
    this.underlyingMap.delete(id);
  }
}

const expectedExecutionDateMap = new Map<number, Date>();
const actualExecutionDateMap = new Map<number, Date>();
const me = new EventTarget();
const destination = new EventTarget();
const server = new Server<(id: number) => Date>({
  terminal: new EventTargetTerminal({ me: destination, destination: me }),
  func: (id: number) => {
    const actualExecutedDate = new Date();
    actualExecutionDateMap.set(id, actualExecutedDate);
    return actualExecutedDate;
  },
});
const client = new Client<typeof server>({
  terminal: new EventTargetTerminal({ me, destination }),
});
const executionRepository = new ExecutionRepositoryMock<(id: number) => void>();
const timeWindowRateLimitationRules = [
  { timeWindowMs: 5000, executionCountPerTimeWindow: 10 },
  { timeWindowMs: 10000, executionCountPerTimeWindow: 15 },
  { timeWindowMs: 20000, executionCountPerTimeWindow: 20 },
];

const executionEventTarget: TypedEventTarget<ExecutionEvent<(id: number) => Date>> =
  new EventTarget();

const executionQueueGateway = createExecutionQueueGateway({
  client,
  executionQueueState: createState<ExecutionQueueState>({ status: 'idle' }),
  executionEventTarget,
  reservationEventTarget: new EventTarget(),
  executionRepository,
  strategy: createExecutionQueueTimeWindowRateLimitationStrategy({ timeWindowRateLimitationRules }),
});

jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'setInterval');

beforeAll(async () => {
  executionQueueGateway.start({});

  for (let i = 0; i < 100; i += 1) {
    const { executedAt } = await executionQueueGateway.enqueue({ args: [i] });
    expectedExecutionDateMap.set(i, executedAt);
  }
});

describe('ExecutionQueueWithTimeWindowRateLimitation', () => {
  describe('enqueue()', () => {
    test('Rate limitations are not exceeded', async () => {
      const executions = await executionRepository.getMany({
        orderBy: { executedAt: 'asc' },
      });

      for (const rule of timeWindowRateLimitationRules) {
        for (let i = 0; i < executions.length - rule.executionCountPerTimeWindow; i += 1) {
          const { executedAt: firstExecutionDate } = executions[i];
          const { executedAt: lastExecutionDate } =
            executions[i + rule.executionCountPerTimeWindow];

          expect(lastExecutionDate.getTime() - firstExecutionDate.getTime()).toBeGreaterThanOrEqual(
            rule.timeWindowMs,
          );
        }
      }
    });

    test('Enqueued executions are executed on time', async () => {
      await jest.advanceTimersByTimeAsync(100000);
      [...expectedExecutionDateMap.entries()].map(([id, expectedExecutionDate]) => {
        const actualExecutedDate = actualExecutionDateMap.get(id);
        expect(actualExecutedDate?.getTime()).toBeDefined();
        if (actualExecutedDate?.getTime() === undefined) {
          return;
        }
        expect(
          Math.abs(actualExecutedDate?.getTime() - expectedExecutionDate.getTime()),
        ).toBeLessThanOrEqual(1);
      });
      expect(await executionRepository.count({ filters: { isExecuted: true } })).toEqual(100);
    });
  });
});
