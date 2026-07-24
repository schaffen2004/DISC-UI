import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronRight, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

const CRUMB_KEYS: Record<string, MessageKey> = {
  "": "nav.dashboard",
  employees: "nav.employees",
  assessments: "nav.assessments",
  questionnaires: "nav.questionnaires",
  reports: "nav.reports",
  analytics: "nav.analytics",
  new: "nav.new",
  result: "nav.result",
  questionnaire: "nav.questionnaire",
  verify: "nav.verify",
};

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, setDark };
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const parts = path.split("/").filter(Boolean);
  const { dark, setDark } = useDarkMode();
  const { displayName, user: authUser, logout, isAuthenticated } = useAuth();
  const t = useT();

  const name = isAuthenticated ? displayName : t("common.guest");
  const subtitle = authUser?.email ?? t("common.signInToContinue");
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "U";
  const user = { name, subtitle, initials };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 backdrop-blur px-3 sm:px-5">
            <SidebarTrigger />
            <nav className="hidden md:flex items-center text-sm text-muted-foreground min-w-0">
              <Link to="/" className="hover:text-foreground transition-colors">
                {t("nav.home")}
              </Link>
              {parts.map((p, i) => (
                <span key={i} className="flex items-center min-w-0">
                  <ChevronRight className="h-3.5 w-3.5 mx-1 opacity-60" />
                  <span className="truncate text-foreground/80 capitalize">
                    {CRUMB_KEYS[p] ? t(CRUMB_KEYS[p]) : p}
                  </span>
                </span>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDark(!dark)}
                aria-label={t("common.toggleTheme")}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.notifications")}
                className="relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {user.initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="space-y-0.5">
                      <div>{user.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {user.subtitle}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        logout();
                        window.location.assign("/login");
                      }}
                    >
                      {t("common.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">{t("auth.signIn")}</Link>
                </Button>
              )}
            </div>
          </header>
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
