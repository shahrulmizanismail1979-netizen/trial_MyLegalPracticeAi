import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListUsers,
  useManagerLogin,
  useManagerLogout,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import {
  sendManagerSetupCode,
  verifyManagerSetupCode,
} from "@/lib/firm-auth-api";

export function ManagerAccess() {
  const { currentUser, setCurrentUser, isManager, workspaceId, refreshSession } = useAuth();
  const { data: users } = useListUsers();
  const { mutateAsync: managerLogin, isPending: loggingIn } = useManagerLogin();
  const { mutateAsync: managerLogout } = useManagerLogout();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [setup, setSetup] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupPending, setSetupPending] = useState(false);

  // The passcode is verified server-side, which mints a signed httpOnly manager
  // session cookie. The browser never decides manager status on its own.
  const handleUnlock = async () => {
    try {
      // Establish the main app manager session (mints tr_mgr httpOnly cookie).
      const res = await managerLogin({
        data: { passcode: passcode.trim() },
      });
      if (!res.manager || !res.user) {
        toast.error(t("manager.noManagerFound"));
        return;
      }

      setCurrentUser(res.user);
      await refreshSession();
      setOpen(false);
      setPasscode("");
      setError(false);
      toast.success(t("manager.unlocked"));
    } catch {
      setError(true);
    }
  };

  const handleExit = async () => {
    try {
      await managerLogout();
      await refreshSession();
    } catch {
      toast.error("Could not exit manager mode. Please try again.");
      return;
    }
    toast.success(t("manager.locked"));
  };

  const sendSetupCode = async () => {
    setSetupPending(true);
    setSetupError("");
    try {
      await sendManagerSetupCode();
      setCodeSent(true);
      toast.success("Verification code sent to the firm's registered email.");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setSetupPending(false);
    }
  };

  const saveManagerPassword = async () => {
    setSetupPending(true);
    setSetupError("");
    try {
      await verifyManagerSetupCode(verificationCode, newPassword);
      setSetup(false);
      setCodeSent(false);
      setVerificationCode("");
      setNewPassword("");
      toast.success("Manager password updated. Sign in with the new password.");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setSetupPending(false);
    }
  };

  if (isManager) {
    return (
      <div className="rounded-xl border border-sidebar-border/40 bg-sidebar-accent/50 p-3 space-y-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 ring-2 ring-primary/30 shadow-sm">
            <AvatarFallback className="text-sm font-bold bg-sidebar-primary text-sidebar-primary-foreground jewel-gradient">
              {currentUser?.name.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-sidebar-accent-foreground truncate">
              {currentUser?.name}
            </span>
            <span className="flex items-center gap-1 text-xs text-primary font-medium">
              <ShieldCheck className="w-3 h-3" />
              {t("manager.modeActive")}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-center h-9 rounded-lg text-xs font-semibold border-sidebar-border/50"
          onClick={handleExit}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          {t("manager.exit")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button
          className="w-full justify-center h-12 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md ring-1 ring-primary/30 jewel-gradient"
          onClick={() => setOpen(true)}
        >
          <ShieldCheck className="w-4 h-4 mr-2" />
          {t("manager.enter")}
          <Lock className="w-3.5 h-3.5 ml-2 opacity-70" />
        </Button>
        {workspaceId !== 0 && (
          <Button variant="ghost" className="w-full text-xs" onClick={() => setSetup(true)}>
            Set/reset manager password
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {t("manager.dialogTitle")}
            </DialogTitle>
            <DialogDescription>{t("manager.dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="password"
              autoFocus
              value={passcode}
              placeholder={t("manager.passwordPlaceholder")}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (error) setError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnlock();
              }}
              className="h-11 rounded-xl text-center tracking-[0.4em] text-lg"
            />
            {error && (
              <p className="text-sm text-destructive font-medium">
                {t("manager.wrongPassword")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleUnlock}
              disabled={loggingIn}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {t("manager.unlock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setup} onOpenChange={setSetup}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Set/reset manager password</DialogTitle>
            <DialogDescription>
              A 6-digit code will be sent only to the registered email for this firm.
            </DialogDescription>
          </DialogHeader>
          {!codeSent ? (
            <Button onClick={sendSetupCode} disabled={setupPending}>
              Send email code
            </Button>
          ) : (
            <div className="space-y-3">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
                placeholder="6-digit email code"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password (at least 12 characters)"
              />
              <Button
                className="w-full"
                onClick={saveManagerPassword}
                disabled={setupPending || verificationCode.length !== 6 || newPassword.length < 12}
              >
                Save manager password
              </Button>
            </div>
          )}
          {setupError && <p className="text-sm text-destructive">{setupError}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
