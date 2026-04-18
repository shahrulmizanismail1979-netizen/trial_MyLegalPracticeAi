import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ALL_APPS = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCorpCommBankLitAi",
  "MyAccidentAi",
];

const PACKAGES = [
  { id: "single", name: "Single App (2nd Kohort)", amount: 148, allApps: false },
  { id: "bundle", name: "Complete Bundle — All 7 Apps (2nd Kohort)", amount: 900, allApps: true },
  { id: "boutique", name: "Boutique — 5 user licences", amount: 1480, allApps: true },
  { id: "practice", name: "Practice — 15 user licences", amount: 3800, allApps: true },
  { id: "firm", name: "Firm — 30 user licences", amount: 6800, allApps: true },
  { id: "faculty-starter", name: "Faculty Starter — 20 academic licences", amount: 1800, allApps: true },
  { id: "faculty-plus", name: "Faculty Plus — 50 academic licences", amount: 3800, allApps: true },
  { id: "campus", name: "Campus — 150 academic licences", amount: 8800, allApps: true },
];

type Props = {
  trigger?: React.ReactNode;
};

export function PayOnlineDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [packageId, setPackageId] = useState<string>("bundle");
  const [selectedApps, setSelectedApps] = useState<string[]>([...ALL_APPS]);

  const pkg = PACKAGES.find((p) => p.id === packageId)!;

  const handlePackageChange = (id: string) => {
    setPackageId(id);
    const newPkg = PACKAGES.find((p) => p.id === id)!;
    if (newPkg.allApps) {
      setSelectedApps([...ALL_APPS]);
    } else {
      setSelectedApps([]);
    }
  };

  const toggleApp = (app: string) => {
    setSelectedApps((prev) =>
      prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      toast.error("Please fill in your name, email and phone");
      return;
    }
    if (selectedApps.length === 0) {
      toast.error("Please select at least one app");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/billplz/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          amount: pkg.amount,
          apps: selectedApps,
          packageName: pkg.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 500 && /not configured/i.test(data?.error || "")) {
          toast.error("Online payment is not yet activated. Please use the QR code option below.");
        } else {
          toast.error(data?.error || "Failed to start payment");
        }
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-12 bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <CreditCard className="h-5 w-5" />
            Pay Online
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Pay Online</DialogTitle>
          <DialogDescription>
            Pay securely via FPX online banking, credit/debit card, or e-wallet (incl. Touch n Go).
            You'll be redirected to a secure checkout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="package">Package</Label>
            <Select value={packageId} onValueChange={handlePackageChange}>
              <SelectTrigger id="package">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PACKAGES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — RM{p.amount.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01x-xxxxxxx"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{pkg.allApps ? "Apps included" : "Choose your app(s)"}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md border border-border bg-muted/20">
              {ALL_APPS.map((app) => (
                <label key={app} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedApps.includes(app)}
                    onCheckedChange={() => toggleApp(app)}
                    disabled={pkg.allApps}
                  />
                  <span>{app}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-baseline justify-between p-3 rounded-md bg-primary/10 border border-primary/20">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">RM{pkg.amount.toLocaleString()}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Redirecting…
                </>
              ) : (
                <>Continue to Payment</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
