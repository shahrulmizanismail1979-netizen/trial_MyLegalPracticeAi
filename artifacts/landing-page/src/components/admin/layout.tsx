import { Link, useLocation } from "wouter";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Layers,
  CreditCard,
  Ticket,
  FileText,
  BarChart3,
  LogOut,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { basePath } from "@/lib/clerk";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  async function handleSignOut() {
    setSignOutError(null);
    try {
      const masterLogout = await fetch("/api/admin/master/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!masterLogout.ok) {
        throw new Error(`Master logout failed with status ${masterLogout.status}`);
      }
    } catch {
      setSignOutError(
        "Unable to end the command-center session. Please try signing out again.",
      );
      return;
    }

    if (isSignedIn) {
      try {
        await signOut({ redirectUrl: basePath || "/" });
      } catch {
        setSignOutError("Unable to sign out. Please try again.");
      }
      return;
    }

    window.location.assign(basePath || "/");
  }

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/app-stats", icon: BarChart3, label: "App Stats" },
    { href: "/admin/subscribers", icon: Users, label: "Subscribers" },
    { href: "/admin/contributions", icon: FileText, label: "Contributions" },
    { href: "/admin/kohorts", icon: Layers, label: "Kohorts" },
    { href: "/admin/pricing", icon: CreditCard, label: "Pricing" },
    { href: "/admin/vouchers", icon: Ticket, label: "Vouchers" },
    { href: "/admin/documents", icon: BookOpen, label: "Documents" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-serif font-bold text-foreground">AI Portals</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wider uppercase font-mono">Command Center</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium shadow-sm" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon size={18} className={isActive ? "text-primary-foreground" : "text-muted-foreground"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border space-y-1">
          {email && (
            <p className="px-3 pb-1 text-xs text-muted-foreground truncate" title={email}>
              {email}
            </p>
          )}
          <Link 
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Site
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
          {signOutError && (
            <p className="px-3 pt-1 text-xs text-destructive" role="alert">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
