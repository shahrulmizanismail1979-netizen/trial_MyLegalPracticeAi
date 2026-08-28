import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FolderOpen,
  ShieldCheck,
  ListOrdered,
  AlertTriangle,
  ScrollText,
  BookOpen,
  Menu,
  LogOut,
  FilePenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={18} /> },
  { label: "Drive Inventory", href: "/drive-inventory", icon: <FolderOpen size={18} /> },
  { label: "Rights Review", href: "/rights-review", icon: <ShieldCheck size={18} /> },
  { label: "Headnotes Review", href: "/headnotes", icon: <BookOpen size={18} /> },
  { label: "Editorial Workbench", href: "/editorial", icon: <FilePenLine size={18} /> },
  { label: "Processing Queue", href: "/queue", icon: <ListOrdered size={18} /> },
  { label: "Error Dashboard", href: "/errors", icon: <AlertTriangle size={18} /> },
  { label: "Audit Log", href: "/audit", icon: <ScrollText size={18} /> },
];

function SidebarContent({
  location,
  onLogout,
  onNavigate,
}: {
  location: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 28, height: 28 }}>
          <svg width="28" height="28" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="180" height="180" rx="36" fill="#FF3C00"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground leading-tight tracking-wide">
            LAWYes
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Case Law Research Admin
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Shell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const handleLogout = async () => {
    await authApi.logout();
    onLogout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col shrink-0 border-r border-sidebar-border">
        <SidebarContent location={location} onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 flex w-64 flex-col">
            <SidebarContent location={location} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold">Case Law Research Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
