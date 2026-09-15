import { renderToString } from "react-dom/server";
import { Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/lib/currency";
import { PersonaProvider } from "@/lib/persona";
import Home from "@/pages/home";
import ContributePage from "@/pages/contribute";
import ManageSubscriptionPage from "@/pages/manage-subscription";
import NotFound from "@/pages/not-found";
import LawYesApp from "@/pages/lawyes";
import LawYesSafePreview from "@/pages/lawyes-safe-preview";
import { AuthView } from "@/pages/lawyes/auth-view";
import { rootExperience } from "@/route-selection";

function normalizePath(path: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  const url = new URL(path || "/", "http://lawyes.local");
  return {
    pathname: url.pathname.replace(/\/+$/, "") || "/",
    search: url.search,
    hash: url.hash,
  };
}

function isLawyesWorkspacePath(pathname: string) {
  return pathname === "/lawyes" || /^\/lawyes\/[^/]+\/?$/.test(pathname);
}

function isStaffPath(pathname: string) {
  return (
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname.startsWith("/staff/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}


/**
 * Clerk widgets require a browser/client provider to complete their flow. SSR
 * still maps those URLs to an explicit staff shell rather than accidentally
 * rendering the public homepage; the client route then mounts Clerk.
 */
function StaffRouteShell({ route }: { route: "sign-in" | "sign-up" | "admin" }) {
  const title =
    route === "admin"
      ? "LAWYes command center"
      : route === "sign-up"
        ? "Create your staff account"
        : "Staff sign in";
  const href = route === "sign-up" ? "/sign-up" : "/staff/sign-in";

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground"
      data-ssr-route={route}
    >
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Enable JavaScript to continue with the secure Clerk staff session.
        </p>
        <a
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          href={href}
        >
          Continue
        </a>
      </section>
    </main>
  );
}

function RouteContent({
  pathname,
  search,
  hash,
}: {
  pathname: string;
  search: string;
  hash: string;
}) {
  if (pathname === "/") {
    return rootExperience(search, hash) === "marketing" ? (
      <Home initialSearch={search} initialHash={hash} />
    ) : (
      <LawYesSafePreview />
    );
  }
  if (pathname === "/apps" || pathname === "/apps/") {
    return <Home initialSearch={search} initialHash={hash} />;
  }
  if (pathname === "/contribute") {
    return <ContributePage initialSearch={search} />;
  }
  if (
    pathname === "/manage-subscription" ||
    pathname.startsWith("/manage-subscription/")
  ) {
    return <ManageSubscriptionPage />;
  }
  if (pathname === "/unsubscribe" || pathname.startsWith("/unsubscribe/")) {
    return <ManageSubscriptionPage />;
  }
  if (pathname === "/sign-in" || pathname.startsWith("/sign-in/")) {
    return <AuthView />;
  }
  if (isLawyesWorkspacePath(pathname)) return <LawYesApp />;
  if (pathname === "/lawyes-safe-preview") {
    return <LawYesSafePreview />;
  }
  if (isStaffPath(pathname)) {
    if (
      pathname === "/sign-up" ||
      pathname.startsWith("/sign-up/") ||
      pathname.startsWith("/staff/sign-up")
    ) {
      return <StaffRouteShell route="sign-up" />;
    }
    if (
      pathname.startsWith("/staff/sign-in") ||
      pathname === "/admin/sign-in" ||
      pathname.startsWith("/admin/login")
    ) {
      return <StaffRouteShell route="sign-in" />;
    }
    return <StaffRouteShell route="admin" />;
  }
  return <NotFound />;
}

/**
 * Render the same route that the client router will select. `path` may include
 * query/hash state because checkout returns and legacy landing anchors are
 * intentionally served by the real Home route.
 */
export function render(path: string = "/"): string {
  const { pathname, search, hash } = normalizePath(path);
  const queryClient = new QueryClient();

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <PersonaProvider>
          <TooltipProvider>
            <WouterRouter ssrPath={pathname} base="">
              <RouteContent
                pathname={pathname}
                search={search}
                hash={hash}
              />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </PersonaProvider>
      </CurrencyProvider>
    </QueryClientProvider>,
  );
}