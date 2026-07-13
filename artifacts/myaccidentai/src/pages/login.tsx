import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAccidentVerifyCode, getAccidentCheckSessionQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scale, Lock, ArrowLeft } from "lucide-react";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const verifyCode = useAccidentVerifyCode();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Please enter an access code");
      return;
    }
    verifyCode.mutate(
      { data: { code: code.trim().toUpperCase() } },
      {
        onSuccess: async (result) => {
          if (result.valid) {
            queryClient.setQueryData(getAccidentCheckSessionQueryKey(), {
              authenticated: true,
              codeLabel: null,
            });
            await queryClient.invalidateQueries({ queryKey: getAccidentCheckSessionQueryKey() });
            await queryClient.refetchQueries({ queryKey: getAccidentCheckSessionQueryKey() });
            setLocation("/workspace");
          } else {
            setError(result.message || "Invalid access code");
          }
        },
        onError: (err: any) => {
          setError(err?.data?.error || "Invalid access code. Please try again.");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Scale className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-2">
            MyAccident<span className="text-primary">Ai</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Accident, Personal Injury & Running Down Practice Platform
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Access Code</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter your access code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 text-center text-lg tracking-wider uppercase bg-background border-border"
                data-testid="input-access-code"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={verifyCode.isPending}
              data-testid="button-submit-code"
            >
              {verifyCode.isPending ? "Verifying..." : "Access Platform"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Access restricted to authorized legal practitioners only.
          </p>
        </div>

        <div className="text-center mt-8 space-y-3">
          <p className="text-xs text-muted-foreground">
            Created by <span className="font-medium text-foreground/70">Prof Madya Dr Shahrul Mizan Ismail</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Fakulti Undang-Undang, Universiti Kebangsaan Malaysia
          </p>
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4" data-testid="link-back-home">
            <ArrowLeft className="h-3 w-3" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
