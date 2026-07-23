import { db } from "@workspace/db";

// A database handle: the global client or a transaction. Domain functions
// accept this so the test harness can point them at an isolated schema and so
// callers can compose them inside a wider transaction.
export type DbClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Structured rejection of an illegal state transition. */
export class StateTransitionError extends Error {
  readonly code = "INVALID_TRANSITION" as const;
  constructor(
    readonly entityType: "container" | "job",
    readonly entityId: number,
    readonly fromState: string,
    readonly toState: string,
  ) {
    super(
      `Invalid ${entityType} transition ${fromState} -> ${toState} (id ${entityId})`,
    );
    this.name = "StateTransitionError";
  }
}

export class EntityNotFoundError extends Error {
  readonly code = "ENTITY_NOT_FOUND" as const;
  constructor(
    readonly entityType: "container" | "job",
    readonly entityId: number,
  ) {
    super(`${entityType} ${entityId} not found`);
    this.name = "EntityNotFoundError";
  }
}
