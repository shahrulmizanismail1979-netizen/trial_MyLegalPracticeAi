import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DarkMode>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <RateLimitWarning />
        </DarkMode>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
