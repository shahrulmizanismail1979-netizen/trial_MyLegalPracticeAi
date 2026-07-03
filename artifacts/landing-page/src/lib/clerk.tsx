import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";

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

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const gold = "#d4af37";

export const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: gold,
    colorForeground: "#fafafa",
    colorMutedForeground: "#a6a6a6",
    colorDanger: "#ef4444",
    colorBackground: "#111111",
    colorInput: "#2e2e2e",
    colorInputForeground: "#fafafa",
    colorNeutral: "#fafafa",
    fontFamily: '"Inter", sans-serif',
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111111] border border-[#262626] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#fafafa] font-serif text-2xl",
    headerSubtitle: "text-[#a6a6a6]",
    socialButtonsBlockButton: "border border-[#262626] bg-[#1a1a1a] hover:bg-[#222222]",
    socialButtonsBlockButtonText: "text-[#fafafa]",
    dividerLine: "bg-[#262626]",
    dividerText: "text-[#a6a6a6]",
    formFieldLabel: "text-[#fafafa]",
    formFieldInput: "bg-[#2e2e2e] text-[#fafafa] border border-[#3a3a3a]",
    formButtonPrimary: "bg-[#d4af37] text-black hover:bg-[#c19f2f]",
    footerActionText: "text-[#a6a6a6]",
    footerActionLink: "text-[#d4af37] hover:text-[#e0bd4a]",
    identityPreviewEditButton: "text-[#d4af37]",
    formFieldSuccessText: "text-[#d4af37]",
    otpCodeFieldInput: "bg-[#2e2e2e] text-[#fafafa] border border-[#3a3a3a]",
    logoImage: "h-10 w-10",
  },
};

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Staff sign in",
      subtitle: "Access the AI Web Books command center",
    },
  },
  signUp: {
    start: {
      title: "Create your staff account",
      subtitle: "Access is limited to authorized staff",
    },
  },
};
