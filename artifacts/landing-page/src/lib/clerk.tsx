import { publishableKeyFromHost } from "@clerk/react/internal";

// REQUIRED — resolves the key from window.location.hostname so the same build
// serves multiple Clerk custom domains. Do not inline the env var.
export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// Empty in dev (Clerk hits dev FAPI directly), auto-set in prod.
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
export function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const primaryBlue = "#6395e0";

export const clerkAppearance = {
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/lawyes-logo.png`,
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: primaryBlue,
    colorForeground: "#1e2535",
    colorMutedForeground: "#6b7280",
    colorDanger: "#dc3545",
    colorBackground: "#ffffff",
    colorInput: "#f0f2f5",
    colorInputForeground: "#1e2535",
    colorNeutral: "#1e2535",
    fontFamily: '"Inter", sans-serif',
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white border border-[#dde1ea] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#1e2535] font-serif text-2xl",
    headerSubtitle: "text-[#6b7280]",
    socialButtonsBlockButton: "border border-[#dde1ea] bg-[#f8f9fb] hover:bg-[#f0f2f5]",
    socialButtonsBlockButtonText: "text-[#1e2535]",
    dividerLine: "bg-[#dde1ea]",
    dividerText: "text-[#6b7280]",
    formFieldLabel: "text-[#1e2535]",
    formFieldInput: "bg-[#f0f2f5] text-[#1e2535] border border-[#dde1ea]",
    formButtonPrimary: "bg-[#6395e0] text-white hover:bg-[#5080cc]",
    footerActionText: "text-[#6b7280]",
    footerActionLink: "text-[#6395e0] hover:text-[#5080cc]",
    identityPreviewEditButton: "text-[#6395e0]",
    formFieldSuccessText: "text-[#6395e0]",
    otpCodeFieldInput: "bg-[#f0f2f5] text-[#1e2535] border border-[#dde1ea]",
    logoImage: "h-10 w-10",
  },
};

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Staff sign in",
      subtitle: "Access the LAWYes command center",
    },
  },
  signUp: {
    start: {
      title: "Create your staff account",
      subtitle: "Access is limited to authorized staff",
    },
  },
};
