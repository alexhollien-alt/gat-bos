"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow, ShowcaseBackdrop } from "@/components/screen";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupFormData) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <ShowcaseBackdrop className="min-h-screen flex items-center justify-center">
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="showcase-card p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="mb-3">
              <Eyebrow tone="crimson">Get Started</Eyebrow>
            </div>
            <h1 className="font-display text-h2-screen font-bold text-foreground tracking-headline">
              Create Account
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Get started with GAT-BOS
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="bg-[var(--surface-raised)] border-white/[0.06] text-foreground placeholder:text-[var(--border-deep)] focus:border-[color:var(--accent-red)]/40 focus:ring-2 focus:ring-[color:var(--accent-red)]/10"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                className="bg-[var(--surface-raised)] border-white/[0.06] text-foreground placeholder:text-[var(--border-deep)] focus:border-[color:var(--accent-red)]/40 focus:ring-2 focus:ring-[color:var(--accent-red)]/10"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                className="bg-[var(--surface-raised)] border-white/[0.06] text-foreground placeholder:text-[var(--border-deep)] focus:border-[color:var(--accent-red)]/40 focus:ring-2 focus:ring-[color:var(--accent-red)]/10"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-[var(--accent-red)] hover:bg-[var(--accent-red-hover)] text-white transition-all hover:-translate-y-px"
              style={{ boxShadow: "0 4px 14px rgba(230,53,80,0.25)" }}
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-foreground underline hover:text-[var(--accent-red)] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </ShowcaseBackdrop>
  );
}
