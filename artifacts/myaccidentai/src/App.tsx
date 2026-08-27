import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { CaseCorpusStatus } from "@workspace/case-home-ui";
import { RateLimitWarning } from "@/components/RateLimitWarning";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Workspace from "@/pages/workspace";
import Admin from "@/pages/admin";
import MattersPage from "@/pages/matters";
import MatterDetailPage from "@/pages/matter-detail";
import BillingPage from "@/pages/billing";
import CaseLawPage from "@/pages/case-law";
import { useEffect } from "react";
import { useAccidentCheckSession } from "@workspace/api-client-react";
import { ParalegalWidget } from "@workspace/paralegal-widget";

const queryClient = new QueryClient();

function DarkMode({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/workspace/matters" component={MattersPage} />
      <Route path="/workspace/matters/:id" component={MatterDetailPage} />
      <Route path="/workspace/billing" component={BillingPage} />
      <Route path="/workspace/case-law" component={CaseLawPage} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

const paralegalRequest = (path: string, init?: RequestInit) =>
  fetch(`/api/accident${path}`, { ...init, credentials: "include" });

/**
 * This remains mounted while users move between workspace routes, while the
 * session check keeps the assistant out of public and admin routes.
 */
function AuthenticatedWorkspaceShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session } = useAccidentCheckSession();
  const isWorkspaceRoute = location === "/workspace" || location.startsWith("/workspace/");

  return (
    <>
      {children}
      {isWorkspaceRoute && session?.authenticated && (
        <ParalegalWidget portalName="MyAccidentAI" request={paralegalRequest} accent="#8a6d2f" />
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DarkMode>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthenticatedWorkspaceShell>
                <Router />
              </AuthenticatedWorkspaceShell>
          </WouterRouter>
          <CaseCorpusStatus />
          <Toaster />
          <RateLimitWarning />
        </DarkMode>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
