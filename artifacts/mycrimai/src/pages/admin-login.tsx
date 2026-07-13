import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Shield, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/lib/admin-api";

export function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminApi.session().then((r) => {
      if (r?.isAdmin) setLocation("/admin");
    }).catch(() => {});
  }, [setLocation]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Please enter the admin password.");
      return;
    }
    setLoading(true);
    try {
      await adminApi.login(password);
      setLocation("/admin");
    } catch (err: any) {
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0 pointer-events-none"></div>
      <div className="z-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-primary/10 p-3 rounded-full border border-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">Admin Access</CardTitle>
            <CardDescription>Restricted area — administrator login required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Admin Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-10 bg-background/50 border-input font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              </div>
              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-border/50 pt-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              &larr; Back to home
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
