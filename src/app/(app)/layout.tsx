import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { CaptureBarServer } from "@/components/capture-bar-server";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-56 p-6 pb-28">{children}</main>
        <CommandPalette />
        <CaptureBarServer />
        <Toaster position="bottom-right" />
      </div>
    </QueryProvider>
  );
}
