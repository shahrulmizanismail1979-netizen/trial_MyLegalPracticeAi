import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { CaseCorpusStatus } from "@workspace/case-home-ui";
import { RateLimitBanner } from "@/lib/rate-limit-monitor";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

const Exam = lazy(() => import("@/pages/exam"));
const Summary = lazy(() => import("@/pages/summary"));
const ExaminerLogin = lazy(() => import("@/pages/examiner/login"));
const ExaminerRegister = lazy(() => import("@/pages/examiner/register"));
const ExaminerDashboard = lazy(() => import("@/pages/examiner/dashboard"));
const ExaminerNew = lazy(() => import("@/pages/examiner/new"));
const TemplateDetail = lazy(() => import("@/pages/examiner/template-detail"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminHealth = lazy(() => import("@/pages/admin/health"));
const CandidateJoin = lazy(() => import("@/pages/candidate/join"));
const Billing = lazy(() => import("@/pages/billing"));

const StudioLanding = lazy(() => import("@/pages/studio/landing"));
const StudioLogin = lazy(() => import("@/pages/studio/login"));
const StudioRegister = lazy(() => import("@/pages/studio/register"));
const StudioDashboard = lazy(() => import("@/pages/studio/dashboard"));
const StudioMarking = lazy(() => import("@/pages/studio/marking"));
const StudioAnalytics = lazy(() => import("@/pages/studio/analytics"));
const StudioMe = lazy(() => import("@/pages/studio/me"));
const StudioFrameworks = lazy(() => import("@/pages/studio/frameworks"));
const StudioJoin = lazy(() => import("@/pages/studio/join"));
const StudioAssessmentEditor = lazy(
  () => import("@/pages/studio/assessment-editor"),
);
const StudioAttempt = lazy(() => import("@/pages/studio/attempt"));
const StudioAttemptSummary = lazy(
  () => import("@/pages/studio/attempt-summary"),
);

import { AuthProvider, RequireAuth, RequireAdmin } from "@/lib/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-7 h-7 animate-spin text-amber-400/70" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/billing" component={Billing} />
        <Route path="/pricing" component={Billing} />

        {/* Exam Hall — examiner pathway */}
        <Route path="/examiner" component={ExaminerLogin} />
        <Route path="/examiner/register" component={ExaminerRegister} />
        <Route path="/examiner/dashboard">
          <RequireAuth>
            <ExaminerDashboard />
          </RequireAuth>
        </Route>
        <Route path="/examiner/new">
          <RequireAuth>
            <ExaminerNew />
          </RequireAuth>
        </Route>
        <Route path="/examiner/templates/:id">
          <RequireAuth>
            <TemplateDetail />
          </RequireAuth>
        </Route>

        {/* Admin-only area */}
        <Route path="/admin">
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        </Route>
        <Route path="/admin/health">
          <RequireAdmin>
            <AdminHealth />
          </RequireAdmin>
        </Route>

        {/* Exam Hall — candidate (passwordless) */}
        <Route path="/candidate" component={CandidateJoin} />
        <Route path="/exam/:id" component={Exam} />
        <Route path="/exam/:id/summary" component={Summary} />

        {/* Assessment Studio */}
        <Route path="/studio" component={StudioLanding} />
        <Route path="/studio/login" component={StudioLogin} />
        <Route path="/studio/register" component={StudioRegister} />
        <Route path="/studio/dashboard">
          <RequireAuth>
            <StudioDashboard />
          </RequireAuth>
        </Route>
        <Route path="/studio/marking">
          <RequireAuth>
            <StudioMarking />
          </RequireAuth>
        </Route>
        <Route path="/studio/analytics">
          <RequireAuth>
            <StudioAnalytics />
          </RequireAuth>
        </Route>
        <Route path="/studio/me" component={StudioMe} />
        <Route path="/studio/assessments/new">
          <RequireAuth>
            <StudioAssessmentEditor />
          </RequireAuth>
        </Route>
        <Route path="/studio/assessments/:id">
          <RequireAuth>
            <StudioAssessmentEditor />
          </RequireAuth>
        </Route>
        <Route path="/studio/frameworks" component={StudioFrameworks} />
        <Route path="/studio/join" component={StudioJoin} />
        <Route path="/studio/attempt/:id" component={StudioAttempt} />
        <Route
          path="/studio/attempt/:id/summary"
          component={StudioAttemptSummary}
        />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <CaseCorpusStatus />
        <Toaster />
            <RateLimitBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
