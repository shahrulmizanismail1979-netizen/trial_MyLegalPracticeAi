import { renderToString } from "react-dom/server";
import { Router as WouterRouter } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/lib/currency";
import { PersonaProvider } from "@/lib/persona";
import Home from "@/pages/home";
import ContributePage from "@/pages/contribute";

export function render(path: string = "/"): string {
  const { hook } = memoryLocation({ path, static: true });
  const queryClient = new QueryClient();

  let PageComponent: () => React.ReactNode;
  if (path === "/contribute") {
    PageComponent = ContributePage;
  } else {
    PageComponent = Home;
  }

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <PersonaProvider>
        <TooltipProvider>
          <WouterRouter hook={hook} base="">
            <PageComponent />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </PersonaProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}
