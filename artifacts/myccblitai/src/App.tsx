import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RateLimitWarning } from "@/components/RateLimitWarning";
import { SessionExpiredRedirect } from "@/components/SessionExpiredRedirect";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupFetchInterceptor } from "@/lib/fetch-interceptor";

// Install the 401 interceptor at module evaluation time (once, before any fetch).
setupFetchInterceptor();
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AccessPage from "@/pages/access";
import WorkspaceIndex from "@/pages/workspace/index";
import ToolPage from "@/pages/workspace/tool";
import ToolsListPage from "@/pages/workspace/tools-list";
import ChatPage from "@/pages/workspace/chat";
import CalculatorsPage from "@/pages/workspace/calculators";
import ReferencePage from "@/pages/workspace/reference";
import StrategyPage from "@/pages/workspace/strategy";
import MattersPage from "@/pages/workspace/matters";
import MatterDetailPage from "@/pages/workspace/matter-detail";
import BillingPage from "@/pages/workspace/billing";
import CaseLawPage from "@/pages/workspace/case-law";
import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/access" component={AccessPage} />
      <Route path="/workspace" component={WorkspaceIndex} />
      <Route path="/workspace/chat" component={ChatPage} />
      <Route path="/workspace/calculators" component={CalculatorsPage} />
      <Route path="/workspace/reference" component={ReferencePage} />
      <Route path="/workspace/strategy" component={StrategyPage} />
      <Route path="/workspace/matters" component={MattersPage} />
      <Route path="/workspace/matters/:id" component={MatterDetailPage} />
      <Route path="/workspace/billing" component={BillingPage} />
      <Route path="/workspace/case-law" component={CaseLawPage} />
      <Route path="/workspace/tools" component={ToolsListPage} />
      <Route path="/workspace/tool/:toolId" component={ToolPage} />
      <Route path="/admin" component={AdminLoginPage} />
      <Route path="/admin/dashboard" component={AdminDashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <RateLimitWarning />
        <SessionExpiredRedirect />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
