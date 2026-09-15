import { Component, type ErrorInfo, type ReactNode, useEffect, useRef } from "react";
import { Redirect, Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { ClerkProvider, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/lib/currency";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ContributePage from "@/pages/contribute";
import ManageSubscriptionPage from "@/pages/manage-subscription";
import {
  SignInPage,
  SignUpPage,
  StaffSignInPage,
  StaffSignUpPage,
} from "@/pages/auth";
import { AdminGuard } from "@/components/admin/admin-guard";
import AdminDashboard from "@/pages/admin/dashboard";
import AppStatsPage from "@/pages/admin/app-stats";
import SubscribersPage from "@/pages/admin/subscribers";
import KohortsPage from "@/pages/admin/kohorts";
import PricingPage from "@/pages/admin/pricing";
import VouchersPage from "@/pages/admin/vouchers";
import ContributionsPage from "@/pages/admin/contributions";
import DocumentsPage from "@/pages/admin/documents";
import LawYesApp from "@/pages/lawyes";
import {
  clerkPubKey,
  clerkProxyUrl,
  clerkAppearance,
  clerkLocalization,
  basePath,
  stripBase,
} from "@/lib/clerk";

import { PersonaProvider } from "@/lib/persona";
import LawYesSafePreview from "@/pages/lawyes-safe-preview";
import { rootExperience } from "@/route-selection";

const queryClient = new QueryClient();

class LandingErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Landing page failed to render", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <section className="max-w-md text-center">
            <h1 className="font-serif text-2xl font-bold">LAWYes is loading</h1>
            <p className="mt-3 text-muted-foreground">
              We could not finish loading this page. Please refresh and try again.
            </p>
            <button
              className="mt-6 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
              type="button"
            >
              Refresh page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

// Keeps the webview cache fresh when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Keep the retained chat-first surface at the bare root. Explicit
          checkout returns and legacy marketing anchors opt into Home. */}
      <Route path="/" component={RootRoute} />
      {/* The marketing page remains available at its explicit /apps route. */}
      <Route path="/apps" component={HomeRoute} />
      <Route path="/apps/*?" component={HomeRoute} />
      <Route path="/contribute" component={ContributeRoute} />
      <Route path="/manage-subscription/*?" component={ManageSubscriptionPage} />
      <Route path="/unsubscribe/*?" component={ManageSubscriptionPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/staff/sign-in/*?" component={StaffSignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/staff/sign-up/*?" component={StaffSignUpPage} />
      {/* Older command-center bookmarks must not send staff to practitioner
          access-code authentication. */}
      <Route path="/admin/sign-in/*?" component={LegacyStaffSignInRedirect} />
      <Route path="/admin/login/*?" component={LegacyStaffSignInRedirect} />
      <Route path="/admin">
        <AdminGuard>
          <AdminDashboard />
        </AdminGuard>
      </Route>
      <Route path="/admin/app-stats">
        <AdminGuard>
          <AppStatsPage />
        </AdminGuard>
      </Route>
      <Route path="/admin/subscribers">
        <AdminGuard>
          <SubscribersPage />
        </AdminGuard>
      </Route>
      <Route path="/admin/contributions">
        <AdminGuard>
          <ContributionsPage />
        </AdminGuard>
      </Route>
      <Route path="/admin/kohorts">
        <AdminGuard>
          <KohortsPage />
        </AdminGuard>
      </Route>
      <Route path="/admin/pricing">
        <AdminGuard>
          <PricingPage />
        </AdminGuard>
      </Route>
      <Route path="/admin/vouchers">
        <AdminGuard>
          <VouchersPage />
        </AdminGuard>
      </Route>
      <Route path="/admin/documents">
        <AdminGuard>
          <DocumentsPage />
        </AdminGuard>
      </Route>
      <Route path="/lawyes" component={LawYesApp} />
      <Route path="/lawyes/:matterId" component={LawYesApp} />
      <Route path="/lawyes-safe-preview" component={LawYesSafePreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HomeRoute() {
  return <Home />;
}

function RootRoute() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return rootExperience(search, hash) === "marketing" ? (
    <Home />
  ) : (
    <LawYesSafePreview />
  );
}

function ContributeRoute() {
  return <ContributePage />;
}

function LegacyStaffSignInRedirect() {
  const search =
    typeof window !== "undefined" ? window.location.search : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return <Redirect to={`/staff/sign-in${search}${hash}`} />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/staff/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <CurrencyProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </CurrencyProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

function PublicApp() {
  return (
    <PersonaProvider>
      <WouterRouter base={basePath}>
        <Providers>
          <Router />
          <Toaster />
        </Providers>
      </WouterRouter>
    </PersonaProvider>
  );
}

function StaffApp() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

function pathWithoutBase(pathname: string) {
  const normalizedBase = basePath.replace(/\/+$/, "");
  if (
    normalizedBase &&
    (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`))
  ) {
    return pathname.slice(normalizedBase.length) || "/";
  }
  return pathname || "/";
}

function isStaffRoute(pathname: string) {
  const path = pathWithoutBase(pathname).replace(/\/+$/, "") || "/";
  return (
    path === "/sign-up" ||
    path.startsWith("/sign-up/") ||
    path.startsWith("/staff/") ||
    path === "/admin" ||
    path.startsWith("/admin/")
  );
}

function App() {
  return (
    <LandingErrorBoundary>
      {typeof window !== "undefined" && isStaffRoute(window.location.pathname) ? (
        <StaffApp />
      ) : (
        <PublicApp />
      )}
    </LandingErrorBoundary>
  );
}

export default App;
