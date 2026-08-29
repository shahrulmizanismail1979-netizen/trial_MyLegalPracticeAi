import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { CaseCorpusStatus } from "@workspace/case-home-ui";
import { RateLimitWarning } from "@/components/RateLimitWarning";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiContextProvider } from "@/contexts/AiContext";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import SectionPage from "@/pages/SectionPage";
import ToolsPage from "@/pages/ToolsPage";
import ToolDetailPage from "@/pages/ToolDetailPage";
import MattersPage from "@/pages/MattersPage";
import MatterDetailPage from "@/pages/MatterDetailPage";
import BillingPage from "@/pages/BillingPage";
import AdminPage from "@/pages/AdminPage";
import PricingPage from "@/pages/PricingPage";
import CaseLawPage from "@/pages/CaseLawPage";
import NotFound from "@/pages/not-found";
import { configurePersonaAuthHeaders } from "@workspace/persona-client";

const queryClient = new QueryClient();

  const t = localStorage.getItem("auth_token");
function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/section/:id" component={SectionPage} />
      <Route path="/tools" component={ToolsPage} />
      <Route path="/tools/:id" component={ToolDetailPage} />
      <Route path="/matters" component={MattersPage} />
      <Route path="/matters/:id" component={MatterDetailPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/case-law" component={CaseLawPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AiContextProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
            <CaseCorpusStatus />
          <Toaster />
          <RateLimitWarning />
        </AiContextProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
