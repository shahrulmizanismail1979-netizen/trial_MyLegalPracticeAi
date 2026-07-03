import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  CreditCard, 
  Ticket,
  FileText,
  LogOut,
  ArrowLeft
} from "lucide-react";
import { basePath } from "@/lib/clerk";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/subscribers", icon: Users, label: "Subscribers" },
    { href: "/admin/contributions", icon: FileText, label: "Contributions" },
    { href: "/admin/kohorts", icon: Layers, label: "Kohorts" },
    { href: "/admin/pricing", icon: CreditCard, label: "Pricing" },
    { href: "/admin/vouchers", icon: Ticket, label: "Vouchers" },
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
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
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
