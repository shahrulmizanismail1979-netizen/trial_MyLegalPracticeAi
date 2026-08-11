import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RateLimitWarning } from "@/components/RateLimitWarning";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import { WorkspaceLayout } from "@/components/layout/workspace-layout";
import { WorkspaceDashboard } from "@/pages/workspace-dashboard";
import { TopicsPage } from "@/pages/topics";
import { TopicDetailPage } from "@/pages/topic-detail";
import { CaseLawsPage } from "@/pages/case-laws";
import { CaseLawDetailPage } from "@/pages/case-law-detail";
import { CausePapersPage } from "@/pages/cause-papers";
import { CausePaperDetailPage } from "@/pages/cause-paper-detail";
import { WorkflowsPage } from "@/pages/workflows-page";
import { WorkflowDetailPage } from "@/pages/workflow-detail";
import { SampleDocumentsPage } from "@/pages/sample-documents";
import { SampleDocumentDetailPage } from "@/pages/sample-document-detail";
import { GlossaryPage } from "@/pages/glossary-page";
import { GlossaryDetailPage } from "@/pages/glossary-detail";
import { CostsFeesPage } from "@/pages/costs-fees-page";
import { CostFeeDetailPage } from "@/pages/cost-fee-detail";
import { SearchPage } from "@/pages/search-page";
import { AiLegalResearchPage } from "@/pages/ai-legal-research";
import { AiCaseAnalyzerPage } from "@/pages/ai-case-analyzer";
import { AiDocumentDrafterPage } from "@/pages/ai-document-drafter";
import { AiChargeAnalyzerPage } from "@/pages/ai-charge-analyzer";
import { AiCrossExaminationPage } from "@/pages/ai-cross-examination";
import { AiWitnessPracticePage } from "@/pages/ai-witness-practice";
import { AiJudgePracticePage } from "@/pages/ai-judge-practice";
import { AiSentencingPage } from "@/pages/ai-sentencing";
import { AiLegalOpinionPage } from "@/pages/ai-legal-opinion";
import { AiCaseStrategyPage } from "@/pages/ai-case-strategy";
import { AiAppealGroundsPage } from "@/pages/ai-appeal-grounds";
import { HowToUsePage } from "@/pages/how-to-use";
import { MattersPage } from "@/pages/matters";
import { MatterDetailPage } from "@/pages/matter-detail";
import { AdminLoginPage } from "@/pages/admin-login";
import { AdminDashboardPage } from "@/pages/admin-dashboard";
import { PricingPage } from "@/pages/pricing";
import { ToolGuard } from "@/components/entitlements/tool-guard";
import type { AiToolId } from "@workspace/entitlements";

const queryClient = new QueryClient();

const WorkspaceRoute = ({
  component: Component,
  toolId,
}: {
  component: () => React.JSX.Element;
  toolId?: AiToolId;
}) => {
  return (
    <WorkspaceLayout>
      {toolId ? (
        <ToolGuard toolId={toolId}>
          <Component />
        </ToolGuard>
      ) : (
        <Component />
      )}
    </WorkspaceLayout>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminDashboardPage} />

      <Route path="/workspace">
        {() => <Redirect to="/workspace/matters" />}
      </Route>
      <Route path="/workspace/how-to-use">
        {() => <WorkspaceRoute component={HowToUsePage} />}
      </Route>
      <Route path="/workspace/topics">
        {() => <WorkspaceRoute component={TopicsPage} />}
      </Route>
      <Route path="/workspace/topics/:id">
        {() => <WorkspaceRoute component={TopicDetailPage} />}
      </Route>
      <Route path="/workspace/case-laws">
        {() => <WorkspaceRoute component={CaseLawsPage} />}
      </Route>
      <Route path="/workspace/case-laws/:id">
        {() => <WorkspaceRoute component={CaseLawDetailPage} />}
      </Route>
      <Route path="/workspace/cause-papers">
        {() => <WorkspaceRoute component={CausePapersPage} />}
      </Route>
      <Route path="/workspace/cause-papers/:id">
        {() => <WorkspaceRoute component={CausePaperDetailPage} />}
      </Route>
      <Route path="/workspace/workflows">
        {() => <WorkspaceRoute component={WorkflowsPage} />}
      </Route>
      <Route path="/workspace/workflows/:id">
        {() => <WorkspaceRoute component={WorkflowDetailPage} />}
      </Route>
      <Route path="/workspace/matters">
        {() => <WorkspaceRoute component={MattersPage} />}
      </Route>
      <Route path="/workspace/matters/:id">
        {() => <WorkspaceRoute component={MatterDetailPage} />}
      </Route>
      <Route path="/workspace/sample-documents">
        {() => <WorkspaceRoute component={SampleDocumentsPage} />}
      </Route>
      <Route path="/workspace/sample-documents/:id">
        {() => <WorkspaceRoute component={SampleDocumentDetailPage} />}
      </Route>
      <Route path="/workspace/glossary">
        {() => <WorkspaceRoute component={GlossaryPage} />}
      </Route>
      <Route path="/workspace/glossary/:id">
        {() => <WorkspaceRoute component={GlossaryDetailPage} />}
      </Route>
      <Route path="/workspace/costs-fees">
        {() => <WorkspaceRoute component={CostsFeesPage} />}
      </Route>
      <Route path="/workspace/costs-fees/:id">
        {() => <WorkspaceRoute component={CostFeeDetailPage} />}
      </Route>
      <Route path="/workspace/search">
        {() => <WorkspaceRoute component={SearchPage} />}
      </Route>

      <Route path="/workspace/ai/research">
        {() => <WorkspaceRoute component={AiLegalResearchPage} toolId="legal-research" />}
      </Route>
      <Route path="/workspace/ai/case-analyzer">
        {() => <WorkspaceRoute component={AiCaseAnalyzerPage} toolId="case-analyzer" />}
      </Route>
      <Route path="/workspace/ai/document-drafter">
        {() => <WorkspaceRoute component={AiDocumentDrafterPage} toolId="document-drafter" />}
      </Route>
      <Route path="/workspace/ai/charge-analyzer">
        {() => <WorkspaceRoute component={AiChargeAnalyzerPage} toolId="charge-analyzer" />}
      </Route>
      <Route path="/workspace/ai/cross-examination">
        {() => <WorkspaceRoute component={AiCrossExaminationPage} toolId="cross-examination" />}
      </Route>
      <Route path="/workspace/ai/witness-practice">
        {() => <WorkspaceRoute component={AiWitnessPracticePage} toolId="witness-practice" />}
      </Route>
      <Route path="/workspace/ai/judge-practice">
        {() => <WorkspaceRoute component={AiJudgePracticePage} toolId="judge-practice" />}
      </Route>
      <Route path="/workspace/ai/sentencing">
        {() => <WorkspaceRoute component={AiSentencingPage} toolId="sentencing" />}
      </Route>
      <Route path="/workspace/ai/legal-opinion">
        {() => <WorkspaceRoute component={AiLegalOpinionPage} toolId="legal-opinion" />}
      </Route>
      <Route path="/workspace/ai/case-strategy">
        {() => <WorkspaceRoute component={AiCaseStrategyPage} toolId="case-strategy" />}
      </Route>
      <Route path="/workspace/ai/appeal-grounds">
        {() => <WorkspaceRoute component={AiAppealGroundsPage} toolId="appeal-grounds" />}
      </Route>

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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
