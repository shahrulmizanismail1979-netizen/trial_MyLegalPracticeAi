import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, ArrowRight, ShieldCheck, FileText, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import { 
  useGetSarawak20Status, 
  useCreateSarawak20Checkout,
  getGetSarawak20StatusQueryKey 
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormField, FormItem } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const posterImg = `${import.meta.env.BASE_URL}campaign-poster.png`;

export default function LandingPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Status query
  const { data: status, isLoading: isStatusLoading, isError: isStatusError } = useGetSarawak20Status();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-lawyes-green selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="w-8 h-8 fill-lawyes-navy" xmlns="http://www.w3.org/2000/svg">
              <path d="M20,20 L40,20 L40,60 L70,60 L70,80 L20,80 Z" />
              <path d="M45,20 L65,45 L95,15 L105,25 L65,70 L35,30 Z" className="fill-lawyes-green" />
            </svg>
            <span className="font-display font-bold text-xl tracking-tight text-lawyes-navy">LAWYes</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-lawyes-navy font-semibold hidden sm:flex" onClick={() => setLocation('/manage-subscription')} data-testid="button-manage-subscription">
              Manage Subscription
            </Button>
            <Button 
              className="bg-lawyes-navy hover:bg-lawyes-navy/90 text-white rounded-full px-6 font-semibold"
              onClick={() => {
                document.getElementById('cohorts-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              data-testid="button-apply-header"
            >
              Apply Now
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-24 lg:pt-24 lg:pb-32 overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-lawyes-navy/5 -skew-x-12 origin-top-right transform translate-x-1/4"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lawyes-navy/10 text-lawyes-navy font-semibold text-sm mb-6 border border-lawyes-navy/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lawyes-green opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-lawyes-green"></span>
                  </span>
                  Founding Programme Now Open
                </div>
                
                <h1 className="text-5xl lg:text-7xl font-black text-lawyes-navy leading-[1.1] mb-6 uppercase">
                  Project <br/>
                  <span className="text-lawyes-green">Sarawak </span> 
                  <span className="bg-lawyes-green text-white px-4 py-1 rounded-full inline-block align-middle transform -translate-y-1">20</span>
                </h1>
                
                <p className="text-2xl font-display font-medium text-lawyes-navy mb-4 border-l-4 border-lawyes-orange pl-4">
                  Built with Sarawak Advocates.<br/>
                  Built for Sarawak Practice.
                </p>
                
                <p className="text-lg text-muted-foreground mb-8">
                  An exclusive co-development programme for 20 Kuching law firms and 20 chambering students.
                  Join us to help shape LAWYes Sarawak Practice Mode.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg" 
                    className="bg-lawyes-orange hover:bg-lawyes-orange/90 text-white text-lg h-14 px-8 rounded-full shadow-lg shadow-lawyes-orange/20"
                    onClick={() => {
                      document.getElementById('cohorts-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    data-testid="button-join-hero"
                  >
                    Join the First 20
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
                
                <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-lawyes-navy">
                  <CheckCircle2 className="w-5 h-5 text-lawyes-green" />
                  Test LAWYes on one real matter today.
                </div>
              </div>

              <div className="relative lg:ml-auto">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500 max-w-md mx-auto">
                  <img src={posterImg} alt="Project Sarawak 20 Campaign Poster" className="w-full h-auto object-cover" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl pointer-events-none"></div>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-border">
                  <div className="flex items-center gap-4">
                    <div className="bg-lawyes-navy/10 p-3 rounded-full">
                      <ShieldCheck className="w-8 h-8 text-lawyes-navy" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Founding Rate</p>
                      <p className="text-xl font-bold text-lawyes-navy">Locked for 12 mos</p>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </section>

        {/* CO-DEVELOPMENT BENEFITS */}
        <section className="py-24 bg-lawyes-navy text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-5xl font-black mb-6 uppercase text-white">
                Not Just Early Access.<br/>
                <span className="text-lawyes-green">A Seat at the Design Table.</span>
              </h2>
              <p className="text-lg text-white/80">
                You aren't buying generic software. You're partnering with us to build practical AI tools that actually work for local practice in Sarawak.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                <div className="bg-lawyes-green/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  <MonitorSmartphone className="w-8 h-8 text-lawyes-green" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">Sarawak-Specific Workflows</h3>
                <p className="text-white/70">
                  Help us map out the exact procedures and processes you deal with daily in the High Court of Sabah and Sarawak. We build the automation; you guide the logic.
                </p>
              </div>
              
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                <div className="bg-lawyes-green/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8 text-lawyes-green" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">Your Firm's Templates</h3>
                <p className="text-white/70">
                  Work directly with our engineers to teach the AI how to draft documents that match your firm's specific house style and formatting preferences.
                </p>
              </div>
              
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                <div className="bg-lawyes-green/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-8 h-8 text-lawyes-green" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">Direct Product Influence</h3>
                <p className="text-white/70">
                  Get a direct line to our product team. What frustrates you most about your current workflow? Tell us, and watch it become a feature.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* COHORTS CHECKOUT SECTION */}
        <section id="cohorts-section" className="py-24 bg-gray-50">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-lawyes-navy mb-4 font-display uppercase">Choose Your Cohort</h2>
              <p className="text-lg text-muted-foreground">
                Strictly limited to 20 places per cohort on a first-come, first-paid basis.
              </p>
            </div>

            {isStatusError ? (
              <div className="text-center p-8 bg-destructive/10 rounded-2xl text-destructive font-medium border border-destructive/20">
                Failed to load programme availability. Please refresh the page.
              </div>
            ) : isStatusLoading || !status ? (
              <div className="grid md:grid-cols-2 gap-8">
                <Skeleton className="h-[400px] rounded-3xl" />
                <Skeleton className="h-[400px] rounded-3xl" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {status.cohorts.map((cohort) => (
                  <CohortCard key={cohort.cohort} cohort={cohort} status={status} />
                ))}
              </div>
            )}
            
            <div className="mt-12 text-center text-sm text-muted-foreground">
              <p>RM49/month rate is protected for {status?.foundingRateMonths || 12} months while continuously subscribed.</p>
              <p>Cancel anytime via the <button type="button" className="font-semibold text-lawyes-navy cursor-pointer hover:underline" onClick={() => setLocation('/manage-subscription')} data-testid="button-manage-inline">management portal</button>.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-border py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="w-6 h-6 fill-lawyes-navy" xmlns="http://www.w3.org/2000/svg">
              <path d="M20,20 L40,20 L40,60 L70,60 L70,80 L20,80 Z" />
              <path d="M45,20 L65,45 L95,15 L105,25 L65,70 L35,30 Z" className="fill-lawyes-green" />
            </svg>
            <span className="font-display font-bold text-lg text-lawyes-navy">LAWYes</span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} LAWYes. Built for Sarawak.
          </p>
        </div>
      </footer>
    </div>
  );
}

function CohortCard({ cohort, status }: { cohort: any, status: any }) {
  const isFirm = cohort.cohort === 'firm';
  
  const createCheckout = useCreateSarawak20Checkout();
  const { toast } = useToast();
  
  const handleCheckout = () => {
    if (cohort.soldOut) return;
    
    createCheckout.mutate({
      data: {
        cohort: cohort.cohort,
        requestId: crypto.randomUUID()
      }
    }, {
      onSuccess: (data) => {
        window.location.assign(data.url);
      },
      onError: () => {
        toast({
          title: "Reservation Failed",
          description: "We couldn't secure a place for you right now. The cohort may have just sold out. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  const progressPercentage = (cohort.activePaid / cohort.capacity) * 100;
  
  return (
    <Card className={`relative overflow-hidden border-2 transition-all duration-300 ${isFirm ? 'border-lawyes-navy shadow-xl shadow-lawyes-navy/10' : 'border-border hover:border-lawyes-green hover:shadow-xl hover:shadow-lawyes-green/10'} rounded-3xl flex flex-col`}>
      {isFirm && (
        <div className="absolute top-0 left-0 w-full bg-lawyes-navy text-white text-center py-1.5 text-xs font-bold uppercase tracking-widest z-10">
          Most Popular
        </div>
      )}
      
      <div className={`p-8 pb-6 flex-grow flex flex-col ${isFirm ? 'pt-12' : ''}`}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-black font-display text-lawyes-navy">{cohort.label}</h3>
          {cohort.soldOut ? (
            <Badge variant="destructive" className="uppercase font-bold">Sold Out</Badge>
          ) : cohort.remaining <= 5 ? (
            <Badge className="bg-lawyes-orange hover:bg-lawyes-orange uppercase font-bold text-white">Only {cohort.remaining} left</Badge>
          ) : (
            <Badge variant="outline" className="bg-lawyes-green/10 text-lawyes-green border-lawyes-green/20 uppercase font-bold">Available</Badge>
          )}
        </div>
        
        <div className="flex items-baseline mb-6">
          <span className="text-5xl font-black text-lawyes-navy">RM{status.price.amount / 100}</span>
          <span className="text-muted-foreground ml-2 font-medium">/{status.price.interval}</span>
        </div>
        
        <ul className="space-y-4 mb-8 flex-grow">
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-lawyes-green shrink-0 mt-0.5" />
            <span className="text-sm text-foreground font-medium">Access to Sarawak Practice Mode co-development</span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-lawyes-green shrink-0 mt-0.5" />
            <span className="text-sm text-foreground font-medium">Direct input into product roadmap</span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-lawyes-green shrink-0 mt-0.5" />
            <span className="text-sm text-foreground font-medium">Founding rate protected for {status.foundingRateMonths} months</span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-lawyes-green shrink-0 mt-0.5" />
            <span className="text-sm text-foreground font-medium">{status.cancellableAnytime ? 'Cancel anytime, no questions asked' : 'Standard commitment terms'}</span>
          </li>
        </ul>
        
        <div className="space-y-4 mt-auto">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-semibold text-lawyes-navy">
              <span>{cohort.activePaid} Joined</span>
              <span>{cohort.capacity} Total</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${cohort.soldOut ? 'bg-destructive' : 'bg-lawyes-green'} rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <Button 
            className={`w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-all ${
              cohort.soldOut 
                ? 'bg-muted text-muted-foreground shadow-none cursor-not-allowed' 
                : isFirm 
                  ? 'bg-lawyes-navy hover:bg-lawyes-navy/90 text-white shadow-lawyes-navy/20' 
                  : 'bg-lawyes-green hover:bg-lawyes-green/90 text-white shadow-lawyes-green/20'
            }`}
            disabled={cohort.soldOut || createCheckout.isPending}
            onClick={handleCheckout}
            data-testid={`button-checkout-${cohort.cohort}`}
          >
            {createCheckout.isPending ? 'Reserving Place...' : cohort.soldOut ? 'Sold Out' : 'Join Cohort'}
            {!cohort.soldOut && !createCheckout.isPending && <ChevronRight className="ml-2 w-5 h-5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
