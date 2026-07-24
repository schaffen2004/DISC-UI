import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register as registerRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — DigiWork" },
      { name: "description", content: "Create your DigiWork DISC workspace account." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const t = useT();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phone = phoneNumber.trim();
    if (!/^\d{10}$/.test(phone)) {
      setError(t("auth.phoneInvalid"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    setSubmitting(true);
    try {
      await registerRequest({
        email: email.trim(),
        password,
        confirmPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone,
      });
      navigate({
        to: "/login",
        search: { registered: email.trim() },
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? formatRegisterError(err.message, t)
          : err instanceof Error
            ? err.message
            : t("auth.registerFailed");
      setError(message);
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
          <h1 className="mt-10 text-3xl font-semibold tracking-tight">{t("auth.registerTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.registerSubtitle")}</p>

          <form className="mt-8 space-y-4" onSubmit={handleRegister}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("auth.firstName")}</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  placeholder="Ava"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("auth.lastName")}</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  placeholder="Chen"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("auth.phone")}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="0901234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
              />
              <p className="text-xs text-muted-foreground">{t("auth.phoneHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={submitting}>
              {submitting ? t("auth.creatingAccount") : t("auth.createAccount")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t("auth.signIn")}
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
            {t("auth.freeToJoin")}
          </div>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight">
            {t("auth.registerHeroTitle")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("auth.registerHeroBody")}</p>
        </div>
      </div>
    </div>
  );
}

function formatRegisterError(message: string, t: (key: MessageKey) => string) {
  switch (message) {
    case "EMAIL_IS_EXIST":
      return t("auth.emailExists");
    case "PHONE_NUMBER_ALREADY_EXIST":
      return t("auth.phoneExists");
    case "PASSWORD_CONFIRM_INCORRECT":
      return t("auth.passwordMismatch");
    default:
      return message;
  }
}
