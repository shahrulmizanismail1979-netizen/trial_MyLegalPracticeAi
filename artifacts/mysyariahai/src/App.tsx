import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import { GateProvider, useGate } from "@/lib/gate-context";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import GateSelectPage from "@/pages/gate-select";
import DashboardPage from "@/pages/dashboard";
import ProvisionsPage from "@/pages/provisions";
import CasesPage from "@/pages/cases";
import CausePapersPage from "@/pages/cause-papers";
import WorkflowsPage from "@/pages/workflows-page";
import GlossaryPage from "@/pages/glossary";
import LegislationPage from "@/pages/legislation";
import QuranicVersesPage from "@/pages/quranic-verses";
import FatwasPage from "@/pages/fatwas";
import PracticeDirectionsPage from "@/pages/practice-directions";
import AnalyzerPage from "@/pages/analyzer";
import AdminPage from "@/pages/admin";
import AICounselPage from "@/pages/ai-counsel";
import FaraidCalculatorPage from "@/pages/faraid-calculator";
import SmartSearchPage from "@/pages/smart-search";
import CaseAnalysisPage from "@/pages/case-analysis";
import DocumentGeneratorPage from "@/pages/document-generator";
import KitabPage from "@/pages/kitab";
import LegalOpinionPage from "@/pages/legal-opinion";
import ComplianceCheckPage from "@/pages/compliance-check";
import ClientIntakePage from "@/pages/client-intake";
import TafsirPage from "@/pages/tafsir";
import VoiceModePage from "@/pages/voice-mode";
import CourtToolsPage from "@/pages/court-tools";
import CaseWorkspacePage from "@/pages/case-workspace";
import AIToolkitPage from "@/pages/ai-toolkit";
import DraftingPage from "@/pages/drafting";
import PricingPage from "@/pages/pricing";
import AccountPage from "@/pages/account";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const { gate } = useGate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 border border-secondary/30 flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;
  if (!gate) return <GateSelectPage />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/provisions" component={ProvisionsPage} />
        <Route path="/cases" component={CasesPage} />
        <Route path="/cause-papers" component={CausePapersPage} />
        <Route path="/workflows" component={WorkflowsPage} />
        <Route path="/glossary" component={GlossaryPage} />
        <Route path="/legislation" component={LegislationPage} />
        <Route path="/quranic-verses" component={QuranicVersesPage} />
        <Route path="/fatwas" component={FatwasPage} />
        <Route path="/practice-directions" component={PracticeDirectionsPage} />
        <Route path="/analyzer" component={AnalyzerPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/ai-counsel" component={AICounselPage} />
        <Route path="/faraid-calculator" component={FaraidCalculatorPage} />
        <Route path="/smart-search" component={SmartSearchPage} />
        <Route path="/case-analysis" component={CaseAnalysisPage} />
        <Route path="/document-generator" component={DocumentGeneratorPage} />
        <Route path="/kitab" component={KitabPage} />
        <Route path="/legal-opinion" component={LegalOpinionPage} />
        <Route path="/compliance-check" component={ComplianceCheckPage} />
        <Route path="/client-intake" component={ClientIntakePage} />
        <Route path="/court-tools" component={CourtToolsPage} />
        <Route path="/tafsir" component={TafsirPage} />
        <Route path="/voice-mode" component={VoiceModePage} />
        <Route path="/case-workspace" component={CaseWorkspacePage} />
        <Route path="/ai-toolkit" component={AIToolkitPage} />
        <Route path="/drafting" component={DraftingPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/account" component={AccountPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <GateProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AuthGate />
              </WouterRouter>
            </GateProvider>
          </AuthProvider>
        </LanguageProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
