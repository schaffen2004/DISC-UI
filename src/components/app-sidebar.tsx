import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  FileQuestion,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const workspaceNav = [
  { titleKey: "nav.dashboard" as MessageKey, url: "/", icon: LayoutDashboard, staffOnly: false },
  { titleKey: "nav.employees" as MessageKey, url: "/employees", icon: Users, staffOnly: true },
  {
    titleKey: "nav.assessments" as MessageKey,
    url: "/assessments",
    icon: ClipboardList,
    staffOnly: false,
  },
  {
    titleKey: "nav.questionnaires" as MessageKey,
    url: "/questionnaires",
    icon: FileQuestion,
    staffOnly: true,
  },
] as const;

const insightsNav = [
  { titleKey: "nav.reports" as MessageKey, url: "/reports", icon: FileText, staffOnly: false },
  {
    titleKey: "nav.analytics" as MessageKey,
    url: "/analytics",
    icon: BarChart3,
    staffOnly: false,
  },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { displayName, user: authUser, isAuthenticated, isStaff } = useAuth();
  const t = useT();
  const isActive = (url: string) =>
    url === "/" ? path === "/" : path === url || path.startsWith(url + "/");

  const workspace = workspaceNav.filter((item) => !item.staffOnly || isStaff);
  const insights = insightsNav.filter((item) => !item.staffOnly || isStaff);

  const name = isAuthenticated ? displayName : t("common.guest");
  const subtitle = authUser?.email ?? t("common.signInToContinue");
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "U";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-14 justify-center border-b p-0">
        <div
          className={cn(
            "flex h-full w-full items-center",
            collapsed ? "justify-center px-0" : "gap-2.5 px-4",
          )}
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold tracking-tight">DigiWork</div>
              <div className="truncate text-xs text-muted-foreground">{t("brand.platform")}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspace.map((item) => {
                const title = t(item.titleKey);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {insights.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.insights")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {insights.map((item) => {
                  const title = t(item.titleKey);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={title}>
                        <Link to={item.url}>
                          <item.icon />
                          <span>{title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-0">
        {isAuthenticated ? (
          <div
            className={cn(
              "flex items-center py-2",
              collapsed ? "justify-center px-0" : "gap-2.5 px-3",
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 text-left">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className={cn(
              "flex items-center py-2 transition-colors hover:bg-sidebar-accent",
              collapsed ? "justify-center px-0" : "gap-2.5 px-3",
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 text-left">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
              </div>
            )}
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
