import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle2, Copy, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { 
  getGetStripeSessionInfoQueryKey,
  useGetStripeSessionInfo,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuccessPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Extract session_id from URL
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('session_id');
  
  const { data: sessionInfo, isLoading, isError } = useGetStripeSessionInfo(
    { session_id: sessionId || '' },
    { 
      query: { 
        enabled: !!sessionId,
        queryKey: getGetStripeSessionInfoQueryKey({ session_id: sessionId || '' }),
        retry: 2
      } 
    }
  );

  // If no session ID, redirect home
  useEffect(() => {
    if (!sessionId) {
      setLocation('/');
    }
  }, [sessionId, setLocation]);

  const copyAccessCode = () => {
    if (sessionInfo?.accessCode) {
      navigator.clipboard.writeText(sessionInfo.accessCode);
      toast({
        title: "Copied!",
        description: "Access code copied to clipboard.",
      });
    }
  };

  const openCustomerPortal = () => {
    // In a real flow we'd likely ask for email again or use the access code directly.
    // For this success screen, if we have the access code, we can initiate a portal session 
    // assuming the backend allows portal creation with just the access code for recent checkouts.
    // But per schema, email is required. The success screen usually just tells them what to do next.
    // Let's redirect them to the manage page where they can enter their email.
    setLocation('/manage-subscription');
  };

  if (!sessionId) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-lawyes-green selection:text-white">
      <header className="w-full border-b border-border bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button type="button" className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation('/')} data-testid="button-home-logo">
            <svg viewBox="0 0 100 100" className="w-8 h-8 fill-lawyes-navy" xmlns="http://www.w3.org/2000/svg">
              <path d="M20,20 L40,20 L40,60 L70,60 L70,80 L20,80 Z" />
              <path d="M45,20 L65,45 L95,15 L105,25 L65,70 L35,30 Z" className="fill-lawyes-green" />
            </svg>
            <span className="font-display font-bold text-xl tracking-tight text-lawyes-navy">LAWYes</span>
          </button>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-12 flex items-center justify-center">
        {isLoading ? (
          <Card className="w-full max-w-2xl p-12 text-center rounded-3xl shadow-xl border-border">
            <Skeleton className="w-24 h-24 rounded-full mx-auto mb-6" />
            <Skeleton className="h-10 w-2/3 mx-auto mb-4" />
            <Skeleton className="h-6 w-1/2 mx-auto mb-12" />
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          </Card>
        ) : isError || !sessionInfo ? (
          <Card className="w-full max-w-lg p-12 text-center rounded-3xl shadow-xl border-destructive/20 bg-destructive/5">
            <div className="bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl text-destructive font-black">!</span>
            </div>
            <h1 className="text-2xl font-black text-destructive font-display mb-4">Verification Pending</h1>
            <p className="text-muted-foreground mb-8">
              We couldn't immediately verify your payment session. This sometimes happens if the page loaded too quickly. Check your email for confirmation details.
            </p>
            <Button onClick={() => setLocation('/')} className="bg-lawyes-navy hover:bg-lawyes-navy/90 text-white font-bold rounded-xl px-8 h-12" data-testid="button-return-home-error">
              Return Home
            </Button>
          </Card>
        ) : (
          <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-10">
              <div className="bg-lawyes-green/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-lawyes-green/20">
                <CheckCircle2 className="w-12 h-12 text-lawyes-green" />
              </div>
              <h1 className="text-4xl font-black text-lawyes-navy font-display uppercase tracking-tight mb-4">
                Welcome to Project Sarawak 20
              </h1>
              <p className="text-lg text-muted-foreground">
                Your place is secured. Thank you for joining the founding cohort.
              </p>
            </div>

            <div className="space-y-6">
              {sessionInfo.accessCode && (
                <Card className="border-lawyes-green/30 bg-lawyes-green/5 shadow-md rounded-2xl overflow-hidden">
                  <div className="h-1.5 w-full bg-lawyes-green"></div>
                  <CardContent className="p-8">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-lawyes-green mb-2">Your Access Code</h2>
                    <p className="text-muted-foreground text-sm mb-4">Keep this code safe. You will use it to sign in to the LAWYes portals included with your founding subscription.</p>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-white border border-border px-6 py-4 rounded-xl flex-grow font-mono text-2xl font-bold tracking-widest text-lawyes-navy shadow-sm">
                        {sessionInfo.accessCode}
                      </div>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-16 w-16 shrink-0 rounded-xl bg-white hover:bg-gray-50 border-border hover:border-lawyes-navy"
                        onClick={copyAccessCode}
                        data-testid="button-copy-access-code"
                      >
                        <Copy className="w-6 h-6 text-lawyes-navy" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border shadow-sm rounded-2xl">
                <CardContent className="p-0">
                  <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                    <div className="p-8">
                      <ShieldCheck className="w-8 h-8 text-lawyes-navy mb-4" />
                      <h3 className="font-bold text-lawyes-navy mb-2">Next Steps</h3>
                      <p className="text-sm text-muted-foreground">
                        Watch your billing email for your access details and further Project Sarawak 20 onboarding information.
                      </p>
                    </div>
                    <div className="p-8 bg-gray-50/50">
                      <ExternalLink className="w-8 h-8 text-lawyes-navy mb-4" />
                      <h3 className="font-bold text-lawyes-navy mb-2">Manage Account</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        You can view your receipts, update payment methods, or cancel your subscription at any time.
                      </p>
                      <Button variant="link" className="p-0 h-auto font-bold text-lawyes-navy hover:text-lawyes-green" onClick={openCustomerPortal} data-testid="button-open-management">
                        Go to Customer Portal <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-12 text-center">
              <Button variant="outline" className="rounded-full border-border font-semibold text-muted-foreground hover:text-lawyes-navy" onClick={() => setLocation('/')} data-testid="button-return-home">
                Back to Homepage
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
