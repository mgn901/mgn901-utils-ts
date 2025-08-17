import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import {
  type Cancel,
  type Enqueue,
  type Execution,
  type ExecutionId,
  type ExecutionRepository,
  createCalculateExecutionDateFromTimeWindowRateLimitationRules,
  executionQueue,
} from './execution-queue.js';
import {
  type Filters,
  type FromRepository,
  type OrderBy,
  repositorySymbol,
} from './repository-utils.js';
import { type SchedulableFunction, schedulableFunctionFromFunction } from './timer.js';

class ExecutionRepositoryMock<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends never[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> implements ExecutionRepository<TFunc, TArgs, TReturned>
{
  public readonly underlyingMap = new Map<ExecutionId, Execution<TArgs>>();

  public async getOneById(id: ExecutionId): Promise<FromRepository<Execution<TArgs>> | undefined> {
    const latestVersion = this.underlyingMap.get(id);
    if (latestVersion === undefined) {
      return undefined;
    }
    return { ...latestVersion, [repositorySymbol.latestVersion]: latestVersion };
  }

  public async getMany(params: {
    readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
    readonly orderBy: OrderBy<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
    readonly offset?: number | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly FromRepository<Execution<TArgs>>[] | readonly []> {
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
    readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
  }): Promise<number> {
    return (await this.getExecutionsBase(params)).length;
  }

  private async getExecutionsBase(params: {
    readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
  }): Promise<Execution<TArgs>[]> {
    return [...this.underlyingMap.entries()]
      .filter(([_, execution]) => {
        const conditions = [
          params.filters?.executedAt instanceof Date === false ||
            execution.executedAt.getTime() === params.filters.executedAt.getTime(),

          params.filters?.executedAt instanceof Date === true ||
            params.filters?.executedAt?.[0] !== 'lte' ||
            params.filters.executedAt[1] <= execution.executedAt,

          params.filters?.executedAt instanceof Date === true ||
            params.filters?.executedAt?.[0] !== 'gte' ||
            execution.executedAt <= params.filters.executedAt[1],

          // 文字列の他のクエリは使わないので未サポート
          typeof params.filters?.status !== 'string' || execution.status === params.filters?.status,
        ];

        return !conditions.some((condition) => condition === false);
      })
      .map(([_, execution]) => execution);
  }

  public async createOne(execution: Execution<TArgs>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async updateOne(execution: Execution<TArgs>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async deleteOneById(id: ExecutionId): Promise<void> {
    this.underlyingMap.delete(id);
  }
}

const expectedExecutionDateMap = new Map<number, Date>();
const actualExecutionDateMap = new Map<number, Date>();
const func = (id: number) => {
  const actualExecutedDate = new Date();
  actualExecutionDateMap.set(id, actualExecutedDate);
  return actualExecutedDate;
};
const schedulableFunction = schedulableFunctionFromFunction(func);
const executionRepository = new ExecutionRepositoryMock<SchedulableFunction<[number], Date>>();
const executionQueueEventTarget = new EventTarget();

const timeWindowRateLimitationRules = [
  { timeWindowMs: 5000, executionCountPerTimeWindow: 10 },
  { timeWindowMs: 10000, executionCountPerTimeWindow: 15 },
  { timeWindowMs: 20000, executionCountPerTimeWindow: 20 },
];

let executionQueueGateway: { readonly enqueue: Enqueue<[number]>; readonly cancel: Cancel };

beforeAll(async () => {
  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout');
  jest.spyOn(global, 'setInterval');

  executionQueueGateway = await executionQueue({
    schedulableFunction,
    executionQueueEventTarget,
    executionRepository,
    calculateExecutionDate: createCalculateExecutionDateFromTimeWindowRateLimitationRules(
      timeWindowRateLimitationRules,
    ),
  });

  for (let i = 0; i < 100; i += 1) {
    const { executedAt } = await executionQueueGateway.enqueue(i);
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
      expect(await executionRepository.count({ filters: { status: 'completed' } })).toEqual(100);
    });
  });
});
