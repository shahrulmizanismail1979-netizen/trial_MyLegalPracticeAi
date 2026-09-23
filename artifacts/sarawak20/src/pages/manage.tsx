import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { ShieldAlert, ArrowLeft, CreditCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateStripeCustomerPortal } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const manageFormSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  accessCode: z.string().min(8, "Enter the access code sent after checkout."),
});

type ManageFormValues = z.infer<typeof manageFormSchema>;

export default function ManagePage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const createPortal = useCreateStripeCustomerPortal();

  const form = useForm<ManageFormValues>({
    resolver: zodResolver(manageFormSchema),
    defaultValues: {
      email: "",
      accessCode: "",
    },
  });

  const onSubmit = (data: ManageFormValues) => {
    createPortal.mutate({
      data: {
        email: data.email,
        accessCode: data.accessCode,
        action: "manage"
      }
    }, {
      onSuccess: (res) => {
        window.location.assign(res.url);
      },
      onError: (err: any) => {
        toast({
          title: "Access Denied",
          description: err?.message || "We couldn't find an active subscription for that email, or the access code is incorrect.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col selection:bg-lawyes-green selection:text-white">
      <header className="w-full border-b border-border bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-lawyes-navy -ml-4"
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project Sarawak 20
          </Button>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 py-12">
        <Card className="w-full max-w-md border-border shadow-xl rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-lawyes-navy"></div>
          <CardHeader className="space-y-3 pb-8 pt-8 text-center">
            <div className="mx-auto bg-lawyes-navy/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
              <ShieldAlert className="w-8 h-8 text-lawyes-navy" />
            </div>
            <CardTitle className="text-2xl font-black font-display text-lawyes-navy uppercase">Manage Subscription</CardTitle>
            <CardDescription className="text-base">
              Enter your billing email to access the secure customer portal where you can update payment methods or cancel your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-lawyes-navy">Billing Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="advocate@firm.com.my" 
                          className="h-12 bg-gray-50"
                          {...field} 
                          data-testid="input-manage-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="accessCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-lawyes-navy">Access Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="MLPA-XXXXX-XXXXX" 
                          className="h-12 bg-gray-50"
                          {...field} 
                          data-testid="input-manage-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-lawyes-navy hover:bg-lawyes-navy/90 text-white font-bold rounded-xl"
                  disabled={createPortal.isPending}
                  data-testid="button-manage-submit"
                >
                  {createPortal.isPending ? 'Verifying...' : 'Access Customer Portal'}
                </Button>
              </form>
            </Form>
            <div className="mt-7 space-y-4 border-t border-border pt-6 text-sm">
              <div>
                <h2 className="font-bold text-lawyes-navy">Before you continue</h2>
                <ul className="mt-2 space-y-1.5 leading-relaxed text-muted-foreground">
                  <li>• Use the billing email attached to the subscription.</li>
                  <li>• Copy the access code exactly from the checkout confirmation.</li>
                  <li>• Open the portal only on a device you trust, especially when changing payment details.</li>
                </ul>
              </div>
              <details className="rounded-lg border border-border bg-gray-50 p-4">
                <summary className="cursor-pointer font-bold text-lawyes-navy">Access and records FAQ</summary>
                <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                  <p><strong className="text-foreground">Why was access denied?</strong><br />Check for typing errors and confirm that the subscription is active. Do not repeatedly share or guess codes.</p>
                  <p><strong className="text-foreground">What should I retain?</strong><br />Keep billing confirmations and receipts under your firm's normal financial-record process.</p>
                  <p><strong className="text-foreground">Can support ask for my code?</strong><br />Treat the code as an account credential. Do not send it in public messages or screenshots.</p>
                </div>
              </details>
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50 border-t border-border flex justify-center py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              <span>Payments secured by Stripe</span>
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
