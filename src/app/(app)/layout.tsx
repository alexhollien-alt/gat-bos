import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="ml-56 p-6">{children}</main>
      <CommandPalette />
      <Toaster position="bottom-right" />
    </div>
  );
}
