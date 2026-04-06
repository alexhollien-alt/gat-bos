"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Megaphone,
  Clock,
  Printer,
  TrendingUp,
  LogOut,
  Search,
  Ticket,
  Zap,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/opportunities", label: "Pipeline", icon: TrendingUp },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/follow-ups", label: "Follow-ups", icon: Clock },
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-slate-200 bg-white flex flex-col">
      <div className="p-5 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
          Relationship CRM
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
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200 space-y-1">
        <button
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            );
          }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Search className="h-4 w-4" />
          Search
          <kbd className="ml-auto text-[10px] font-mono bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
            {"\u2318"}K
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-500 hover:text-slate-700"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
