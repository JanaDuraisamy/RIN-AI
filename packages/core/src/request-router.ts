import { randomUUID } from 'node:crypto';

import { API_VERSION, type CoreApiRequest, type CoreApiResponse } from '@rin/types';

export interface RequestContext extends CoreApiRequest {
  traceId: string;
}

export type RequestHandler = (request: RequestContext, payload?: unknown) => unknown;

export class RequestRouter {
  private readonly handlers = new Map<string, RequestHandler>();

  register(component: string, handler: RequestHandler): void {
    this.handlers.set(component, handler);
  }

  unregister(component: string): boolean {
    return this.handlers.delete(component);
  }

  has(component: string): boolean {
    return this.handlers.has(component);
  }

  listComponents(): string[] {
    return [...this.handlers.keys()];
  }

  async dispatch(request: CoreApiRequest, payload?: unknown): Promise<CoreApiResponse<unknown>> {
    const startedAt = performance.now();
    const traceId = randomUUID();
    const context: RequestContext = { ...request, traceId };
    const handler = this.handlers.get(request.callingComponent);
    if (handler === undefined) {
      return this.errorResponse(
        context,
        'METHOD_NOT_FOUND',
        `No handler registered for '${request.callingComponent}'`,
        startedAt,
      );
    }
    try {
      const result = await handler(context, payload);
      return this.successResponse(result, startedAt);
    } catch (error) {
      return this.errorResponse(
        context,
        'METHOD_ERROR',
        error instanceof Error ? error.message : String(error),
        startedAt,
      );
    }
  }

  private successResponse(result: unknown, startedAt: number): CoreApiResponse<unknown> {
    return {
      status: 'success',
      result,
      error: null,
      executionTimeMs: this.elapsed(startedAt),
      version: API_VERSION,
    };
  }

  private errorResponse(
    context: RequestContext,
    code: string,
    message: string,
    startedAt: number,
  ): CoreApiResponse<unknown> {
    return {
      status: 'error',
      result: null,
      error: { code, message, traceId: context.traceId },
      executionTimeMs: this.elapsed(startedAt),
      version: API_VERSION,
    };
  }

  private elapsed(startedAt: number): number {
    return Math.round(performance.now() - startedAt);
  }
}
