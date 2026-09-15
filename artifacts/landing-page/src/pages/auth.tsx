import { SignIn, SignUp } from "@clerk/react";
import { useLocation } from "wouter";
import { basePath } from "@/lib/clerk";
import { AuthView } from "@/pages/lawyes/auth-view";
import { StaffSignInLoading } from "@/components/staff-sign-in-loading";
import {
  practitionerAuthDestination,
} from "@/pages/lawyes/auth-routing";
export {
  practitionerAuthDestination,
  validatedLawyesReturnTo,
} from "@/pages/lawyes/auth-routing";

/**
 * Practitioner authentication is intentionally separate from Clerk. LAWYes
 * access codes are issued by the subscription/access-code service and are
 * verified by the LAWYes API before a session is created.
 */
export function SignInPage() {
  return <PractitionerAuthPage />;
}

function ClerkAuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}

/** Existing Clerk staff sign-in, now available at the explicit staff route. */
export function StaffSignInPage() {
  return (
    <ClerkAuthFrame>
      <SignIn
        fallback={<StaffSignInLoading />}
        routing="path"
        path={`${basePath}/staff/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/admin`}
      />
    </ClerkAuthFrame>
  );
}

/** Keep the historical /sign-up URL as the Clerk staff registration flow. */
export function SignUpPage() {
  return (
    <ClerkAuthFrame>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/staff/sign-in`}
        forceRedirectUrl={`${basePath}/admin`}
      />
    </ClerkAuthFrame>
  );
}

/** Explicit alias for deployments that link staff registration by namespace. */
export function StaffSignUpPage() {
  return (
    <ClerkAuthFrame>
      <SignUp
        routing="path"
        path={`${basePath}/staff/sign-up`}
        signInUrl={`${basePath}/staff/sign-in`}
        forceRedirectUrl={`${basePath}/admin`}
      />
    </ClerkAuthFrame>
  );
}

export function PractitionerAuthPage() {
  const [location] = useLocation();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://lawyes.local";
  const returnTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo")
      : null;

  return (
    <AuthView
      returnTo={practitionerAuthDestination(location, returnTo, origin)}
    />
  );
}