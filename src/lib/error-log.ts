// Shared error_logs writer. Every cron/internal API route uses the same
// fire-and-forget pattern to log failures without failing the response.
import { adminClient } from "@/lib/supabase/admin";

export async function logError(
  endpoint: string,
  error_message: string,
  context: Record<string, unknown>,
  error_code?: number,
) {
  await adminClient
    .from("error_logs")
    .insert({ endpoint, error_code: error_code ?? null, error_message, context })
    .then(() => null, () => null);
}
