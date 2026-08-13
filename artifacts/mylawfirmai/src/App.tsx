import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RateLimitBanner } from "@/lib/rate-limit-monitor";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { StaffGate } from "@/components/StaffGate";
import { LanguageProvider } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import UrgentPage from "@/pages/urgent";
import BacklogPage from "@/pages/backlog";
import MinePage from "@/pages/mine";
import DashboardPage from "@/pages/dashboard";
import DigestPage from "@/pages/digest";
import TaskDetailPage from "@/pages/task-detail";
import GoalsPage from "@/pages/goals";
import RecognitionPage from "@/pages/recognition";
import ManualPage from "@/pages/manual";
import MeetingsPage from "@/pages/meetings";
import MeetingDetailPage from "@/pages/meeting-detail";
import VoicePage from "@/pages/voice";
import InboxPage from "@/pages/inbox";
import ActivityPage from "@/pages/activity";
import HrPage from "@/pages/hr";
import AccountsPage from "@/pages/accounts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep every lens "live": poll the shared task list so a change made
      // by one person surfaces on everyone else's screen within a few
      // seconds, and refresh immediately when a tab regains focus. Polling
      // pauses while the tab is hidden to avoid needless background load.
      refetchInterval: 8000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/urgent" />} />
      <Route path="/urgent" component={UrgentPage} />
      <Route path="/backlog" component={BacklogPage} />
      <Route path="/mine" component={MinePage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/activity" component={ActivityPage} />
      <Route path="/digest" component={DigestPage} />
      <Route path="/goals" component={GoalsPage} />
      <Route path="/recognition" component={RecognitionPage} />
      <Route path="/meetings" component={MeetingsPage} />
      <Route path="/meeting/:id" component={MeetingDetailPage} />
      <Route path="/voice" component={VoicePage} />
      <Route path="/inbox" component={InboxPage} />
      <Route path="/manual" component={ManualPage} />
      <Route path="/task/:id" component={TaskDetailPage} />
      <Route path="/hr" component={HrPage} />
      <Route path="/accounts" component={AccountsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <LanguageProvider>
            <StaffGate>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
            </StaffGate>
          </LanguageProvider>
        </AuthProvider>
        <Toaster />
        <RateLimitBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
