import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Layout & UI
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/toaster";
import { RateLimitWarning } from "@/components/RateLimitWarning";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Dashboard from "@/pages/Dashboard";
import Theory from "@/pages/Theory";
import Workflows from "@/pages/Workflows";
import PracticeHub from "@/pages/PracticeHub";
import PracticeMatter from "@/pages/PracticeMatter";
import Forms from "@/pages/Forms";
import Jurisprudence from "@/pages/Jurisprudence";
import Costs from "@/pages/Costs";
import Terminology from "@/pages/Terminology";
import Chambers from "@/pages/Chambers";
import OralPractice from "@/pages/OralPractice";
import Matters from "@/pages/Matters";
import MatterDetail from "@/pages/MatterDetail";
import Diary from "@/pages/Diary";
import Billing from "@/pages/Billing";
import BankingRecovery from "@/pages/BankingRecovery";
import Enforcement from "@/pages/Enforcement";
import Bundles from "@/pages/Bundles";
import BundleDetail from "@/pages/BundleDetail";
import Compliance from "@/pages/Compliance";
import Appeals from "@/pages/Appeals";
import Affidavits from "@/pages/Affidavits";
import CaseLaw from "@/pages/CaseLaw";
import NotFound from "@/pages/not-found";
import { SubscriptionGate } from "@/components/SubscriptionGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
});

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

// Protected + subscription-gated route for premium features.
function PremiumRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) return <Redirect to="/login" />;

  return (
    <Layout>
      <SubscriptionGate>
        <Component />
      </SubscriptionGate>
    </Layout>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/app" /> : <Landing />}
      </Route>
      
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/app" /> : <Login />}
      </Route>

      {/* Protected App Routes */}
      <Route path="/app"><Redirect to="/app/matters" /></Route>
      <Route path="/app/practice"><ProtectedRoute component={PracticeHub} /></Route>
      <Route path="/app/practice/:matterId"><ProtectedRoute component={PracticeMatter} /></Route>
      <Route path="/app/theory"><ProtectedRoute component={Theory} /></Route>
      <Route path="/app/workflows"><ProtectedRoute component={Workflows} /></Route>
      <Route path="/app/forms"><ProtectedRoute component={Forms} /></Route>
      <Route path="/app/jurisprudence"><ProtectedRoute component={Jurisprudence} /></Route>
      <Route path="/app/costs"><ProtectedRoute component={Costs} /></Route>
      <Route path="/app/terminology"><ProtectedRoute component={Terminology} /></Route>
      <Route path="/app/chambers"><PremiumRoute component={Chambers} /></Route>
      <Route path="/app/oral-practice"><ProtectedRoute component={OralPractice} /></Route>
      <Route path="/app/my-work"><Redirect to="/app/matters" /></Route>
      <Route path="/app/matters"><ProtectedRoute component={Matters} /></Route>
      <Route path="/app/matters/:id"><ProtectedRoute component={MatterDetail} /></Route>
      <Route path="/app/diary"><ProtectedRoute component={Diary} /></Route>
      <Route path="/app/billing"><ProtectedRoute component={Billing} /></Route>
      <Route path="/app/case-law"><ProtectedRoute component={CaseLaw} /></Route>
      <Route path="/app/banking-recovery"><PremiumRoute component={BankingRecovery} /></Route>
      <Route path="/app/enforcement"><PremiumRoute component={Enforcement} /></Route>
      <Route path="/app/bundles"><PremiumRoute component={Bundles} /></Route>
      <Route path="/app/bundles/:id"><PremiumRoute component={BundleDetail} /></Route>
      <Route path="/app/compliance"><PremiumRoute component={Compliance} /></Route>
      <Route path="/app/appeals"><PremiumRoute component={Appeals} /></Route>
      <Route path="/app/affidavits"><PremiumRoute component={Affidavits} /></Route>

      <Route path="/admin"><Admin /></Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <RateLimitWarning />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
