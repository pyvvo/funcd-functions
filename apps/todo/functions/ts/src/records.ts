// The records the todo App keeps in KV, shared by the API, the migrate hook and the collect step.

/** A todo of table todos, keyed by its id. Schema 1 (1.0.0) holds the title; schema 2 (1.1.0) adds done. */
export interface TodoRecord {
  title: string;
  done?: boolean;
}

/** The input of a hook call (funcd ADR-0214). */
export interface HookInput {
  event: 'install' | 'upgrade' | 'rollback';
  app: string;
  from?: string;
  to: string;
  fromVersion?: string;
  toVersion?: string;
}

/** What the migrate hook writes under key last of table meta. */
export interface MigrationRecord extends HookInput {
  by: string;
  migrated: number;
}

/** What the warm hook writes under key last of table warm. */
export interface ReleaseRecord {
  by: string;
  event: string;
  revision: string;
  version: string;
}
