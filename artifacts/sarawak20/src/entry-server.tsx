import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import LandingPage from '@/pages/landing';

export function render(): string {
  const queryClient = new QueryClient();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter ssrPath="/" base="">
          <LandingPage />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}