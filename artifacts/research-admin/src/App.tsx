import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { CaseCorpusStatus } from '@workspace/case-home-ui';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import LoginPage from '@/pages/login';
import { Shell } from '@/components/layout/shell';
import DashboardPage from '@/pages/dashboard';
import DriveInventoryPage from '@/pages/drive-inventory';
import RightsReviewPage from '@/pages/rights-review';
import HeadnotesReviewPage from '@/pages/headnotes-review';
import ProcessingQueuePage from '@/pages/processing-queue';
import ErrorDashboardPage from '@/pages/error-dashboard';
import AuditLogPage from '@/pages/audit-log';

const queryClient = new QueryClient();

function AppRoutes({ onLogout }: { onLogout: () => void }) {
  return (
    <Shell onLogout={onLogout}>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/drive-inventory" component={DriveInventoryPage} />
          <Route path="/rights-review" component={RightsReviewPage} />
          <Route path="/headnotes" component={HeadnotesReviewPage} />
          <Route path="/queue" component={ProcessingQueuePage} />
          <Route path="/errors" component={ErrorDashboardPage} />
          <Route path="/audit" component={AuditLogPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AuthGate() {
  const { state, login, logout } = useAuth();

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'unauthenticated') {
    return <LoginPage onLogin={login} />;
  }

  return <AppRoutes onLogout={logout} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthGate />
        </WouterRouter>
        <CaseCorpusStatus />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
