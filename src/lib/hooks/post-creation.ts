// Post-creation hook dispatcher.
//
// Called fire-and-forget from every entity-creation surface (POST /api/projects,
// POST /api/contacts, calendar create + sync-in). Routes to per-kind handlers
// in src/lib/hooks/handlers/. Each handler is wrapped in its own try/catch so
// one failure cannot cascade. Failures are logged to activity_events
// (verb='hook.failed') and to error_logs, then swallowed -- this dispatcher
// MUST NOT throw and MUST NOT block the calling response.
//
// Tasks 3 / 5 / 6 add concrete handlers to the per-kind branches below.
//
// Slice 5B -- 2026-04-27.

import { writeEvent } from '@/lib/activity/writeEvent';
import { logError } from '@/lib/error-log';
import { autoEnrollNewAgentHandler } from './handlers/contact-auto-enroll';
import { contactWelcomeTaskHandler } from './handlers/contact-created';
import { projectCreatedHandler } from './handlers/project-created';
import { eventCreatedHandler } from './handlers/event-created';

export type HookEntityKind = 'project' | 'contact' | 'event';

export interface FirePostCreationHooksInput {
  entityKind: HookEntityKind;
  entityId: string;
  payload: Record<string, unknown>;
  ownerUserId: string;
}

type Handler = (input: FirePostCreationHooksInput) => Promise<void>;

interface NamedHandler {
  name: string;
  run: Handler;
}

function handlersFor(kind: HookEntityKind): NamedHandler[] {
  switch (kind) {
    case 'project':
      return [{ name: 'project-created', run: projectCreatedHandler }];
    case 'contact':
      // Two handlers run independently. autoEnroll failures must not block
      // welcome-task creation, and vice versa.
      return [
        { name: 'contact-auto-enroll', run: autoEnrollNewAgentHandler },
        { name: 'contact-welcome-task', run: contactWelcomeTaskHandler },
      ];
    case 'event':
      return [{ name: 'event-created', run: eventCreatedHandler }];
  }
}

export async function firePostCreationHooks(
  input: FirePostCreationHooksInput,
): Promise<void> {
  const handlers = handlersFor(input.entityKind);
  for (const { name, run } of handlers) {
    try {
      await run(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logError('hooks/post-creation', message, {
        handler: name,
        entityKind: input.entityKind,
        entityId: input.entityId,
      });
      await writeEvent({
        actorId: input.ownerUserId,
        verb: 'hook.failed',
        object: { table: tableForKind(input.entityKind), id: input.entityId },
        context: { handler: name, error: message },
      });
    }
  }
}

function tableForKind(kind: HookEntityKind): string {
  switch (kind) {
    case 'project':
      return 'projects';
    case 'contact':
      return 'contacts';
    case 'event':
      return 'events';
  }
}
