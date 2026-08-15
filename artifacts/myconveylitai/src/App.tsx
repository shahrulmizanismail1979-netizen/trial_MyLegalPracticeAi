import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RateLimitWarning } from "@/components/RateLimitWarning";
import { setResponseInterceptor } from "@workspace/api-client-react";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";

// Register a response interceptor so the shared API client emits rate-limit
// events whenever it receives a rate-limit header from the server.
setResponseInterceptor((res) => {
  const n = readRateLimitRemaining(res);
  if (n !== null) emitRateLimit(n);
});
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { Pricing } from "@/pages/Pricing";
import { Home } from "@/pages/Home";
import { Dashboard } from "@/pages/Dashboard";
import { Admin } from "@/pages/Admin";
import { Matters } from "@/pages/Matters";
import { MatterDetail } from "@/pages/MatterDetail";
import { Billing } from "@/pages/Billing";
import CaseLawPage from "@/pages/case-law";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useApp();
  if (isAuthenticated) {
    // Redirect authenticated users to matters (case-centric home)
    return <Redirect to="/matters" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Home />
      </Route>
      <Route path="/login">
        <AuthRoute component={Login} />
      </Route>
      <Route path="/signup">
        <AuthRoute component={Signup} />
      </Route>
      <Route path="/pricing">
        <Pricing />
      </Route>
      {/* /dashboard is the AI workspace — still accessible after login */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/matters">
        <ProtectedRoute component={Matters} />
      </Route>
      <Route path="/matters/:id">
        <ProtectedRoute component={MatterDetail} />
      </Route>
      <Route path="/billing">
        <ProtectedRoute component={Billing} />
      </Route>
      <Route path="/case-law">
        <ProtectedRoute component={CaseLawPage} />
      </Route>
      <Route path="/admin">
        <Admin />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <RateLimitWarning />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
