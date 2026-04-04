// src/lib/supabase/admin.ts
// Service-role client for API routes. Bypasses RLS. Never use in browser code.
import { createClient } from "@supabase/supabase-js";

export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
