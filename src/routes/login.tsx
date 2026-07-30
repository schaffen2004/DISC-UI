import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ArrowRight, ShieldCheck, LineChart, Users } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

const searchSchema = z.object({
  registered: z.string().email().optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — DigiWork" },
      { name: "description", content: "Sign in to your DigiWork DISC workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const { registered } = Route.useSearch();
  const t = useT();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [username, setUsername] = useState(registered ?? "");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState(registered ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      const raw =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("auth.loginFailed");
      setError(formatLoginError(raw, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await forgotPassword(forgotEmail.trim());
      setSuccess(
        t("auth.forgotPasswordSuccess", {
          email: result.email,
          password: result.temporaryPassword,
        }),
      );
      setUsername(result.email);
      setPassword(result.temporaryPassword);
      setMode("signin");
    } catch (err) {
      const raw =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("auth.forgotPasswordFailed");
      setError(formatForgotPasswordError(raw, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <LanguageSwitcher variant="button" />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">DigiWork</span>
          </div>
          <h1 className="mt-10 text-3xl font-semibold tracking-tight">
            {mode === "forgot" ? t("auth.forgotPasswordTitle") : t("auth.welcomeBack")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot" ? t("auth.forgotPasswordHint") : t("auth.signInSubtitle")}
          </p>

          {registered && mode === "signin" && !success && (
            <div className="mt-6 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 px-3 py-2 text-sm text-[var(--success)]">
              {t("auth.accountCreated", { email: registered })}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 px-3 py-2 text-sm text-[var(--success)]">
              {success}
            </div>
          )}

          {mode === "signin" ? (
            <form className="mt-8 space-y-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setForgotEmail(username.trim() || registered || "");
                      setMode("forgot");
                    }}
                  >
                    {t("auth.forgotPassword")}
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" defaultChecked />
                <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                  {t("auth.rememberMe")}
                </Label>
              </div>
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                {submitting ? t("auth.signingIn") : t("auth.signIn")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleForgotPassword}>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t("auth.email")}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                {submitting ? t("auth.forgotPasswordSubmitting") : t("auth.forgotPasswordSubmit")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setError(null);
                  setMode("signin");
                }}
              >
                {t("auth.backToSignIn")}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t("auth.createAccount")}
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px circle at 80% 20%, oklch(0.7 0.18 258 / 0.18), transparent 40%), radial-gradient(500px circle at 20% 80%, oklch(0.72 0.16 155 / 0.12), transparent 40%)",
          }}
        />
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            {t("auth.loginHeroBadge")}
          </div>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight">{t("auth.loginHeroTitle")}</h2>
          <p className="mt-4 text-muted-foreground">{t("auth.loginHeroBody")}</p>

          <div className="mt-8 grid gap-3">
            {(
              [
                { icon: Users, key: "auth.loginHeroFeature1" as const },
                { icon: LineChart, key: "auth.loginHeroFeature2" as const },
                { icon: ShieldCheck, key: "auth.loginHeroFeature3" as const },
              ] as const
            ).map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-3 rounded-xl border bg-background/60 backdrop-blur px-4 py-3"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{t(f.key)}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border bg-background/70 backdrop-blur p-5">
            <p className="text-sm italic text-muted-foreground">{t("auth.loginHeroQuote")}</p>
            <div className="mt-3 text-xs font-medium text-muted-foreground">
              {t("auth.loginHeroQuoteBy")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLoginError(message: string, t: (key: MessageKey) => string) {
  switch (message) {
    case "ACCOUNT_DOES_NOT_EXIST":
      return t("auth.accountNotFound");
    case "WRONG_PASSWORD":
      return t("auth.wrongPassword");
    case "USER_IS_NOT_ACTIVE":
      return t("auth.userNotActive");
    case "USER_IS_LOCK":
    case "USER_LOCKED":
      return t("auth.userLocked");
    case "USER_IS_DELETE":
      return t("auth.userDeleted");
    default:
      return message || t("auth.loginFailed");
  }
}

function formatForgotPasswordError(message: string, t: (key: MessageKey) => string) {
  switch (message) {
    case "EMAIL_NOT_FOUND":
    case "Not Found":
      return t("auth.forgotPasswordEmailNotFound");
    case "USER_LOCKED":
    case "USER_IS_LOCK":
      return t("auth.userLocked");
    default:
      return message || t("auth.forgotPasswordFailed");
  }
}
