import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

/** Restrict page content to ADMIN / OPERATOR. */
export function StaffOnly({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, isStaff } = useAuth();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-md p-6 text-center space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Sign in required</h1>
          <p className="text-sm text-muted-foreground">
            This area is available to Admin and Operator accounts only.
          </p>
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  if (!isStaff) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-md p-6 text-center space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            Only Admin and Operator roles can use this feature.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  return <>{children}</>;
}
