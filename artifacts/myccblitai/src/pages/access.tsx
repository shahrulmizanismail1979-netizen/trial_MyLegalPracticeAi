import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { setToken } from "@/lib/auth";
import { Shield, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function AccessPage() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const { toast } = useToast();
  
  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/ccb/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid access code");
      return data as { success: boolean; token: string };
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({
        title: "Code required",
        description: "Please enter your access code.",
        variant: "destructive"
      });
      return;
    }

    verifyMutation.mutate(code, {
      onSuccess: (data) => {
        if (data.success && data.token) {
          setToken(data.token);
          toast({
            title: "Access Granted",
            description: "Welcome to MyCCBLitAI Workspace.",
          });
          setLocation("/workspace");
        } else {
          toast({
            title: "Access Denied",
            description: "Invalid access code. Please try again.",
            variant: "destructive"
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Access Denied",
          description: "Invalid access code or server error.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 bg-[url('/bg-pattern.svg')] bg-repeat">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">MyCCBLit<span className="text-primary">AI</span></h1>
          <p className="text-muted-foreground">Authorized practitioners only</p>
        </div>

        <Card className="border-border/50 shadow-2xl shadow-primary/5 bg-card/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl font-serif text-center">Secure Access</CardTitle>
            <CardDescription className="text-center">
              Enter your practitioner access code to proceed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="Enter access code" 
                    className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    data-testid="input-access-code"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-10 font-medium" 
                disabled={verifyMutation.isPending}
                data-testid="button-submit-access"
              >
                {verifyMutation.isPending ? "Verifying..." : "Masuk / Enter"}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          &copy; {new Date().getFullYear()} Faculty of Law, Universiti Kebangsaan Malaysia. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
