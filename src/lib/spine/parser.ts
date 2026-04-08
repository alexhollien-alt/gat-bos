// src/lib/spine/parser.ts
// Real implementation in Task 12. Stub for now so parse route compiles.

export type ParseResult =
  | { ok: true; data: { id: string; parsed: boolean } }
  | { ok: false; error: string };

export async function parseInboxEntry(_inboxId: string): Promise<ParseResult> {
  return { ok: false, error: "parser not yet implemented, see Task 12" };
}
