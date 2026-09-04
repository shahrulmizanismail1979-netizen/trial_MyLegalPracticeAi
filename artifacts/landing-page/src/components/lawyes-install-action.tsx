import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function LawYesInstallAction() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosGuidance, setShowIosGuidance] = useState(false);

  useEffect(() => {
    const updateInstalledState = () => setInstalled(isInstalled());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowIosGuidance(false);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIosGuidance(false);
      setInstalled(true);
    };

    updateInstalledState();
    if (!isInstalled() && isIos()) {
      setShowIosGuidance(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const requestInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  if (installed) return null;

  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={requestInstall}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Install LAWYes app"
        data-testid="button-install-lawyes"
      >
        <Download size={16} />
        Install LAWYes app
      </button>
    );
  }

  if (showIosGuidance) {
    return (
      <p
        className="flex items-start gap-3 px-3 py-2 text-xs leading-5 text-[hsl(var(--lawyes-sidebar-muted))]"
        data-testid="text-ios-install-guidance"
      >
        <Share size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>To install LAWYes, use Share and choose “Add to Home Screen”.</span>
      </p>
    );
  }

  return null;
}