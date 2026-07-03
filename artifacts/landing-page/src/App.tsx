import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ContributePage from "@/pages/contribute";
import AdminDashboard from "@/pages/admin/dashboard";
import SubscribersPage from "@/pages/admin/subscribers";
import KohortsPage from "@/pages/admin/kohorts";
import PricingPage from "@/pages/admin/pricing";
import VouchersPage from "@/pages/admin/vouchers";
import ContributionsPage from "@/pages/admin/contributions";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/contribute" component={ContributePage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/subscribers" component={SubscribersPage} />
      <Route path="/admin/contributions" component={ContributionsPage} />
      <Route path="/admin/kohorts" component={KohortsPage} />
      <Route path="/admin/pricing" component={PricingPage} />
      <Route path="/admin/vouchers" component={VouchersPage} />
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;