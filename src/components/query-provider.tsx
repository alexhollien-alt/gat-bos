"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query provider wrapping the (app) layout.
 *
 * Per ~/.claude/rules/dashboard.md, this is the foundation that every
 * dashboard widget reads from. Widgets should use useQuery + Supabase Realtime
 * channel.invalidateQueries pattern from Section 6 of the architecture doc.
 *
 * Default staleTime is 30s. Widgets override per data type:
 *   - KPI cards: 60s
 *   - Task lists: 30s + Realtime invalidation
 *   - Agent profiles: 5 minutes
 *   - User preferences: Infinity
 *
 * The QueryClient is created inside useState so SSR gets its own instance
 * while the client reuses a singleton across re-renders.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
