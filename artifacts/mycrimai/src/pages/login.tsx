import { useCrimVerifyAccessCode } from "@workspace/api-client-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Scale, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  
  const verifyCode = useCrimVerifyAccessCode();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!accessCode) {
      setError("Please enter your access code.");
      return;
    }

    verifyCode.mutate(
      { data: { accessCode } },
      {
        onSuccess: (data) => {
          if (data.authenticated) {
            setLocation("/workspace");
          } else {
            setError(data.message || "Invalid access code.");
          }
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || err?.message || "Failed to verify access code.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0 pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-primary/10 p-3 rounded-full border border-primary/20">
              <Scale className="h-8 w-8 text-primary" />
            </div>
          </Link>
        </div>

        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">Private Access</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Enter your practitioner access code to enter the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Access Code</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="accessCode"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-10 bg-background/50 border-input font-mono"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              </div>
              <Button 
                type="submit" 
                className="w-full h-10 font-medium tracking-wide" 
                disabled={verifyCode.isPending}
              >
                {verifyCode.isPending ? "Verifying..." : "Enter Workspace"}
                {!verifyCode.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-border/50 pt-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              &larr; Back to MyCrimAi home
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
