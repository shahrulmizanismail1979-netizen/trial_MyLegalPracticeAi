import { useState } from "react";
import { BookMarked, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({ onLogin }: { onLogin: (pwd: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(password);
    } catch {
      setError("Invalid password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl overflow-hidden">
            <svg width="48" height="48" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="180" height="180" rx="36" fill="#FF3C00"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">LAWYes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Case Law Research Admin</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Admin Password
              </Label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="pl-9"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Malaysian Independent Case Law Intelligence Repository
        </p>
      </div>
    </div>
  );
}
