import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, ArrowRight, ShieldCheck, LineChart, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">DigiWork</span>
          </div>
          <h1 className="mt-10 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to continue with your DISC assessment workspace.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <Label htmlFor="username">Username / email</Label>
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
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </a>
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
                Remember me for 30 days
              </Label>
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button className="w-full" size="lg" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="relative py-2">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase tracking-wider text-muted-foreground">
                or
              </span>
            </div>

            <Button variant="outline" className="w-full" size="lg" type="button" disabled>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a href="#" className="font-medium text-primary hover:underline">
              Contact sales
            </a>
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
            DISC v3 · Enterprise
          </div>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight">
            Understand your people, at team scale.
          </h2>
          <p className="mt-4 text-muted-foreground">
            DigiWork gives teams a single surface for behavioral assessments, reporting, and
            longitudinal comparisons.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              { icon: Users, title: "Fair, evidence-based hiring signals" },
              { icon: LineChart, title: "Longitudinal team trends over years" },
              { icon: ShieldCheck, title: "SOC 2 · GDPR · SSO out of the box" },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-xl border bg-background/60 backdrop-blur px-4 py-3"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{f.title}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border bg-background/70 backdrop-blur p-5">
            <p className="text-sm italic text-muted-foreground">
              "DigiWork cut our assessment cycle from six weeks to four days.
              The reports are the clearest we've ever shipped."
            </p>
            <div className="mt-3 text-xs font-medium">
              Priya Ramesh <span className="text-muted-foreground">· VP People, Lattice Systems</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
