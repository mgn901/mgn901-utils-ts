import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { Client, EventTargetTerminal, Server } from './asyncify-events.js';
import {
  type Execution,
  ExecutionQueueWithTimeWindowRateLimitation,
  ExecutionReducers,
  type ExecutionRepository,
} from './execution-queue.js';
import { type Id, generateId } from './random-values.js';
import {
  type Filters,
  type FromRepository,
  type OrderBy,
  repositorySymbol,
} from './repository-utils.js';

class ExecutionRepositoryMock<
  TId,
  TFunc extends (this: unknown, ...args: never[]) => TReturned,
  TReturned = ReturnType<TFunc>,
> implements ExecutionRepository<TId, TFunc, TReturned>
{
  public readonly underlyingMap = new Map<TId, Execution<TId, TFunc, TReturned>>();

  public async getOneById(
    id: TId,
  ): Promise<FromRepository<Execution<TId, TFunc, TReturned>> | undefined> {
    const latestVersion = this.underlyingMap.get(id);
    if (latestVersion === undefined) {
      return undefined;
    }
    return { ...latestVersion, [repositorySymbol.latestVersion]: latestVersion };
  }

  public async getMany(params: {
    readonly filters?: Filters<Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'>>;
    readonly orderBy: OrderBy<Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'>>;
    readonly offset?: number | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly FromRepository<Execution<TId, TFunc, TReturned>>[] | readonly []> {
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
    readonly filters?: Filters<Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'>>;
  }): Promise<number> {
    return (await this.getExecutionsBase(params)).length;
  }

  private async getExecutionsBase(params: {
    readonly filters?: Filters<Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'>>;
  }): Promise<Execution<TId, TFunc, TReturned>[]> {
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

  public async createOne(execution: Execution<TId, TFunc, TReturned>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async updateOne(execution: Execution<TId, TFunc, TReturned>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async deleteOneById(id: TId): Promise<void> {
    this.underlyingMap.delete(id);
  }
}

const expectedExecutionDateMap = new Map<number, Date>();
const actualExecutionDateMap = new Map<number, Date>();
const me = new EventTarget();
const destination = new EventTarget();
const server = new Server<(id: number) => void>({
  terminal: new EventTargetTerminal({ me: destination, destination: me }),
  func: (id: number) => {
    actualExecutionDateMap.set(id, new Date());
  },
});
const client = new Client<typeof server>({
  terminal: new EventTargetTerminal({ me, destination }),
});
const executionRepository = new ExecutionRepositoryMock<Id, (id: number) => void>();
const timeWindowRateLimitationRules = [
  { timeWindowMs: 5000, executionCountPerTimeWindow: 10 },
  { timeWindowMs: 10000, executionCountPerTimeWindow: 15 },
  { timeWindowMs: 20000, executionCountPerTimeWindow: 20 },
];

const executionQueue = ExecutionQueueWithTimeWindowRateLimitation.create<
  Id,
  (id: number) => void,
  void
>({
  client,
  timeWindowRateLimitationRules,
  executionFactory: ExecutionReducers.createFactory({ generateId }),
  executionRepository: executionRepository,
});

jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'setInterval');

beforeAll(async () => {
  for (let i = 0; i < 100; i += 1) {
    const { executedAt } = await executionQueue.enqueue(i);
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
