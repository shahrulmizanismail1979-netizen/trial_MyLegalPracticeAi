import { useEffect } from "react";
import { QrCode, MessageCircle, Wallet, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayOnlineDialog } from "./pay-online-dialog";
import { toast } from "sonner";

export function Payment() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("payment");
    if (status === "success") {
      toast.success("Payment received! We'll activate your access shortly.");
    } else if (status === "failed") {
      toast.error("Payment was not completed. You can try again.");
    } else if (status === "error") {
      toast.error("There was a problem confirming your payment. Please contact us on WhatsApp.");
    }
    if (status) {
      url.searchParams.delete("payment");
      url.searchParams.delete("bill");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <section id="payment" className="py-24 px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Secure Your <span className="text-primary">Access</span>
        </h2>
        <p className="text-muted-foreground text-lg">
          Pay securely online, or use Touch 'n Go QR with WhatsApp confirmation.
        </p>
      </div>

      {/* Online Payment Card */}
      <div className="bg-card p-8 rounded-2xl border border-primary/40 shadow-[0_0_30px_rgba(212,175,55,0.15)] mb-12">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <CreditCard className="h-7 w-7" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-serif text-2xl font-medium mb-2">Pay Online (Recommended)</h3>
            <p className="text-muted-foreground mb-4">
              FPX online banking, credit/debit card, or e-wallet (incl. Touch n Go). Instant
              confirmation — no WhatsApp follow-up needed.
            </p>
          </div>
          <PayOnlineDialog />
        </div>
      </div>

      <div className="relative my-12">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-sm text-muted-foreground uppercase tracking-wider">
            or pay manually
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* QR Code Column */}
        <div className="bg-card p-8 rounded-2xl border border-border shadow-2xl flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
            <QrCode className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl font-medium mb-2">Scan to Pay</h3>
          <p className="text-muted-foreground mb-6">
            Touch 'n Go eWallet transfer to<br />
            <strong className="text-foreground">Shahrul Mizan Ismail</strong>
          </p>
          
          <div className="p-4 bg-white rounded-xl mb-4 w-full max-w-[280px] aspect-square flex items-center justify-center overflow-hidden">
            <img 
              src={import.meta.env.BASE_URL + "qr-code.jpeg"} 
              alt="TNG eWallet QR Code" 
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                // Fallback if image is missing
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = '<div class="text-black text-center p-4 border-2 border-dashed border-gray-300 rounded-lg w-full h-full flex flex-col items-center justify-center"><QrCode size={48} class="mb-2 text-gray-400" /><p class="font-medium text-gray-500">QR Code Image</p></div>';
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span>Secure TNG Transfer</span>
          </div>
        </div>

        {/* Instructions Column */}
        <div className="space-y-8">
          <div className="relative pl-8 pb-8 border-l border-border/50 last:pb-0 last:border-0">
            <div className="absolute left-0 top-0 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold">1</div>
            <h4 className="font-serif text-xl font-medium mb-2">Make Payment</h4>
            <p className="text-muted-foreground">
              Scan the QR code and transfer the exact amount based on your chosen package (RM148 for Single App or RM900 for the Bundle).
            </p>
          </div>
          
          <div className="relative pl-8 pb-8 border-l border-border/50 last:pb-0 last:border-0">
            <div className="absolute left-0 top-0 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold">2</div>
            <h4 className="font-serif text-xl font-medium mb-2">Save Receipt</h4>
            <p className="text-muted-foreground">
              Take a screenshot or save the payment receipt from your TNG eWallet app.
            </p>
          </div>

          <div className="relative pl-8">
            <div className="absolute left-0 top-0 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold">3</div>
            <h4 className="font-serif text-xl font-medium mb-2">Send Proof</h4>
            <p className="text-muted-foreground mb-6">
              WhatsApp the proof of payment along with your name, email, and the app(s) you wish to access.
            </p>
            <a href="https://wa.me/60173678484" target="_blank" rel="noopener noreferrer">
              <Button className="w-full sm:w-auto h-12 bg-[#25D366] text-white hover:bg-[#20bd5a] border-none font-medium gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp 017-3678484
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}