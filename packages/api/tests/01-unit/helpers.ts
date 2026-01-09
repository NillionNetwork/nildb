import { Effect as E, Exit } from "effect";
import { expect } from "vitest";

export function assertExitSuccess<E, A>(effect: E.Effect<A, E>, onSuccess?: (value: A) => void): void {
  const exit = E.runSyncExit(effect);
  expect(Exit.isSuccess(exit), "Expected exit success but got failure.").toBe(true);
  if (Exit.isSuccess(exit) && onSuccess) {
    onSuccess(exit.value);
  }
}

export function assertExitFailure<E, A>(effect: E.Effect<A, E>, onFailure?: (error: E) => void): void {
  const exit = E.runSyncExit(effect);
  expect(Exit.isFailure(exit), "Expected exit failure but got success.").toBe(true);
  if (Exit.isFailure(exit) && onFailure) {
    const error = (exit.cause as any).error as E;
    onFailure(error);
  }
}
