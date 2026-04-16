import { QrCode, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Payment() {
  return (
    <section id="payment" className="py-24 px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Secure Your <span className="text-primary">Access</span>
        </h2>
        <p className="text-muted-foreground text-lg">
          Follow these simple steps to activate your subscription.
        </p>
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