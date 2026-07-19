import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useUpdateUserContact } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export function ContactReminderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { currentUser, setCurrentUser } = useAuth();
  const t = useT();
  const updateContact = useUpdateUserContact();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  useEffect(() => {
    if (open && currentUser) {
      setPhone(currentUser.phone ?? "");
      setConsent(currentUser.whatsappOptIn);
      setSmsConsent(currentUser.smsOptIn);
    }
  }, [open, currentUser]);

  if (!currentUser) return null;

  const trimmedPhone = phone.trim();
  const consentDisabled = trimmedPhone.length === 0;

  const handleSave = () => {
    updateContact.mutate(
      {
        id: currentUser.id,
        data: {
          phone: trimmedPhone || null,
          whatsappOptIn: consent && trimmedPhone.length > 0,
          smsOptIn: smsConsent && trimmedPhone.length > 0,
          actingUserId: currentUser.id,
        },
      },
      {
        onSuccess: (updated) => {
          setCurrentUser(updated);
          onOpenChange(false);
          toast.success(t("contact.toast.saved"));
        },
        onError: () => toast.error(t("contact.toast.error")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            {t("contact.dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("contact.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="contact-phone">{t("contact.phoneLabel")}</Label>
            <Input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              placeholder={t("contact.phonePlaceholder")}
              onChange={(e) => {
                setPhone(e.target.value);
                if (e.target.value.trim().length === 0) setConsent(false);
              }}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              {t("contact.phoneHint")}
            </p>
          </div>

          <label
            htmlFor="contact-consent"
            className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
              consentDisabled
                ? "opacity-60 cursor-not-allowed border-border/50"
                : "cursor-pointer border-primary/30 bg-primary/5 hover:bg-primary/10"
            }`}
          >
            <Checkbox
              id="contact-consent"
              checked={consent}
              disabled={consentDisabled}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed text-foreground/90">
              {t("contact.consentText")}
            </span>
          </label>

          <label
            htmlFor="contact-sms-consent"
            className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
              consentDisabled
                ? "opacity-60 cursor-not-allowed border-border/50"
                : "cursor-pointer border-primary/30 bg-primary/5 hover:bg-primary/10"
            }`}
          >
            <Checkbox
              id="contact-sms-consent"
              checked={smsConsent}
              disabled={consentDisabled}
              onCheckedChange={(v) => setSmsConsent(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed text-foreground/90">
              {t("contact.smsConsentText")}
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateContact.isPending}
            className="rounded-xl font-semibold"
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
