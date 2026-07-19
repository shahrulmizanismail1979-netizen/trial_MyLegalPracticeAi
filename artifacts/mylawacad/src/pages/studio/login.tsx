import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CinematicShell, GoldButton, SpotlightCard } from "@/components/cinematic-studio";
import { SocialLoginGate } from "@/components/social-login-gate";
import { useLogin } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    setError("");
    try {
      await loginMutation.mutateAsync({ data });
      await refresh();
      setLocation("/studio/dashboard");
    } catch (err: any) {
      setError(err?.data?.message || "Invalid credentials");
    }
  }

  return (
    <CinematicShell showFooter={false}>
      <div className="flex-1 flex items-center justify-center p-6">
        <SpotlightCard className="w-full max-w-md p-8">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-display font-bold text-gold">Welcome Back</h1>
            <p className="text-muted-foreground text-sm uppercase tracking-widest">Sign in to Studio</p>
          </div>

          <div className="mb-6">
            <SocialLoginGate mode="sign in" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {error && <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm border border-red-500/20">{error}</div>}
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="educator@university.edu" className="bg-black/50 border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="bg-black/50 border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <GoldButton type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Authenticating..." : "Sign In"}
              </GoldButton>
              
              <div className="text-center pt-4">
                <Link href="/studio/register" className="text-sm text-muted-foreground hover:text-white transition-colors">
                  Don't have an account? Register
                </Link>
              </div>
            </form>
          </Form>
        </SpotlightCard>
      </div>
    </CinematicShell>
  );
}
