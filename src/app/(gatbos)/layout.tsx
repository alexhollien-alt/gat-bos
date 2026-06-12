// GAT-BOS redesign shell. Sibling route group to (app) so the legacy sidebar
// never renders here. Same providers as (app)/layout.tsx; new forest shell.
// Auth: middleware.ts matcher covers /new/* like every other route.

import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { GatbosSidebar } from "@/components/gatbos/sidebar";

export default function GatbosLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex min-h-screen font-hanken" style={{ background: "var(--gatbos-cream)" }}>
        <GatbosSidebar />
        <main className="flex-1 min-w-0">{children}</main>
        <Toaster position="bottom-right" />
      </div>
    </QueryProvider>
  );
}
