"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login, completeTwoFactorLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({ email, password });
      if ("requiresTwoFactor" in result) {
        setPendingToken(result.pendingToken);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await completeTwoFactorLogin(pendingToken, code);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-lightprimary px-4">
      <div className="w-full min-w-max md:min-w-[450px] max-w-md">
        <Card style={{ borderRadius: "7px" }}>
          <div className="mb-4 flex justify-center">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                AI
              </span>
              <span className="text-lg font-semibold text-foreground">AI SalesOS</span>
            </div>
          </div>

          {pendingToken ? (
            <>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Open your authenticator app and enter the 6-digit code.
              </p>
              <form onSubmit={onVerifyTwoFactor}>
                <div>
                  <Label htmlFor="code" className="mb-2 font-medium">
                    Code
                  </Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-lg tracking-[0.3em]"
                  />
                </div>

                {error && <p className="mt-4 text-sm text-error">{error}</p>}

                <Button type="submit" className="mt-6 w-full" disabled={submitting || code.length !== 6}>
                  {submitting ? "Verifying…" : "Verify"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingToken(null);
                    setCode("");
                    setError(null);
                  }}
                  className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Turn WhatsApp conversations into organized sales.
              </p>
              <form onSubmit={onSubmit}>
                <div>
                  <Label htmlFor="email" className="mb-2 font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="mt-6">
                  <Label htmlFor="password" className="mb-2 font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="mt-4 text-sm text-error">{error}</p>}

                <Button type="submit" className="mt-6 w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">New company?</p>
                <Link href="/register" className="text-sm font-medium text-primary hover:text-primaryemphasis">
                  Create an organization
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
