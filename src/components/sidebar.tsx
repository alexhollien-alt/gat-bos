"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Sun,
  Users,
  CheckSquare,
  Megaphone,
  Printer,
  TrendingUp,
  LogOut,
  Search,
  Ticket,
  Zap,
  BarChart3,
  Inbox,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/captures", label: "Captures", icon: Sparkles },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/opportunities", label: "Pipeline", icon: TrendingUp },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/materials", label: "Materials", icon: Printer },
  { href: "/tickets", label: "Tickets", icon: Ticket },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-border bg-background flex flex-col">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          GAT-BOS
        </h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            );
          }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Search className="h-4 w-4" />
          Search
          <kbd className="ml-auto text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
            {"\u2318"}K
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
