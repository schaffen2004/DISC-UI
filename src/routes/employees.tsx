import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Plus, Search, Download, MoreHorizontal, Mail, Phone, ArrowRightLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import {
  listUsers,
  updateUserRole,
  userDisplayName,
  userInitials,
  userStatusLabel,
  type AssignableUserRole,
  type UserListItem,
} from "@/lib/api/users";
import { isAdminRole, normalizeRole } from "@/lib/roles";
import { useT, userStatusMessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/employees")({
  head: () => ({
    meta: [
      { title: "Employees — DigiWork" },
      { name: "description", content: "Browse and manage users from your workspace." },
    ],
  }),
  component: EmployeesPage,
});

const statusStyle: Record<string, string> = {
  New: "bg-muted text-muted-foreground border-border",
  Active: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
  Locked: "bg-destructive/10 text-destructive border-destructive/25",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function nextAssignableRole(role?: string | null): AssignableUserRole | null {
  const r = normalizeRole(role);
  if (r === "CUSTOMER") return "OPERATOR";
  if (r === "OPERATOR") return "CUSTOMER";
  return null;
}

function EmployeesPage() {
  const { isAuthenticated, user: authUser, role: authRole } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserListItem | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const pageSize = 10;
  const canManageRoles = isAdminRole(authRole);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const usersQuery = useQuery({
    queryKey: ["users", "all", { search, page, limit: pageSize }],
    queryFn: () => listUsers({ search, page, limit: pageSize }),
    enabled: isAuthenticated,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignableUserRole }) =>
      updateUserRole(userId, role),
    onSuccess: (data) => {
      setRoleError(null);
      setSelected((prev) => (prev && prev.id === data.id ? { ...prev, role: data.role } : prev));
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      setRoleError(err instanceof ApiError ? err.message : (err as Error)?.message || "Failed to update role");
    },
  });

  const rows = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedNextRole = selected ? nextAssignableRole(selected.role) : null;
  const canChangeSelectedRole =
    canManageRoles &&
    !!selected &&
    !!selectedNextRole &&
    selected.id !== authUser?.id;

  return (
    <StaffOnly>
    <AppShell>
      <div className="space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {t("employees.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAuthenticated
                ? usersQuery.isLoading
                  ? t("employees.subtitleLoading")
                  : t("employees.subtitleCount", { pageCount: rows.length, total })
                : t("common.signInToContinue")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              {t("employees.export")}
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t("employees.invite")}
            </Button>
          </div>
        </header>

        {!isAuthenticated && (
          <Card className="p-4 text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t("common.signIn")}
            </Link>{" "}
            {t("employees.signInToLoad")}
          </Card>
        )}

        <Card className="p-4">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("employees.search")}
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={!isAuthenticated}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[280px]">{t("employees.colEmployee")}</TableHead>
                  <TableHead>{t("employees.colCompany")}</TableHead>
                  <TableHead>{t("employees.colRole")}</TableHead>
                  <TableHead>{t("employees.colStatus")}</TableHead>
                  <TableHead>{t("employees.colPhone")}</TableHead>
                  <TableHead>{t("employees.colCreated")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("employees.loading")}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {usersQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-destructive">
                      {(usersQuery.error as Error)?.message || t("employees.loadFailed")}
                    </TableCell>
                  </TableRow>
                )}
                {!usersQuery.isLoading && !usersQuery.isError && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                      {t("employees.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((e) => {
                  const name = userDisplayName(e);
                  const status = userStatusLabel(e.status);
                  return (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(e)}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                              {userInitials(e)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{name}</div>
                            <div className="truncate text-xs text-muted-foreground">{e.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{e.company || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.role || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", statusStyle[status] ?? statusStyle.New)}
                        >
                          {t(userStatusMessageKey(status))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.phoneNumber || e.phone || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(e.createdDate)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-xs text-muted-foreground">
              {t("employees.pageOf", { page, totalPages })}
            </div>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(Math.max(1, page - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={page === i + 1}
                      onClick={(ev) => {
                        ev.preventDefault();
                        setPage(i + 1);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(Math.min(totalPages, page + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </Card>
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setRoleError(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                      {userInitials(selected)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{userDisplayName(selected)}</SheetTitle>
                    <SheetDescription className="truncate">
                      {selected.role || "User"}
                      {selected.company ? ` · ${selected.company}` : ""}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("employees.colStatus")}</div>
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          statusStyle[userStatusLabel(selected.status)] ?? statusStyle.New,
                        )}
                      >
                        {t(userStatusMessageKey(userStatusLabel(selected.status)))}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("employees.colRole")}</div>
                    <div className="mt-1 text-sm font-medium">{selected.role || "—"}</div>
                  </div>
                </div>

                {canManageRoles && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div>
                      <div className="text-sm font-medium">{t("employees.changeRole")}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("employees.changeRoleHint")}
                      </p>
                    </div>
                    {canChangeSelectedRole && selectedNextRole ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={roleMutation.isPending}
                        onClick={() => {
                          setRoleError(null);
                          roleMutation.mutate({
                            userId: selected.id,
                            role: selectedNextRole,
                          });
                        }}
                      >
                        {roleMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                        {selectedNextRole === "OPERATOR"
                          ? t("employees.setAsOperator")
                          : t("employees.setAsCustomer")}
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {selected.id === authUser?.id
                          ? t("employees.cannotChangeOwn")
                          : t("employees.cannotChangeRole")}
                      </p>
                    )}
                    {roleError && <p className="text-xs text-destructive">{roleError}</p>}
                  </div>
                )}

                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-sm font-medium">{t("employees.contact")}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {selected.email}
                  </div>
                  {(selected.phoneNumber || selected.phone) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {selected.phoneNumber || selected.phone}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("employees.colCreated")}</div>
                    <div className="mt-1 font-medium">{formatDate(selected.createdDate)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("employees.lastLogin")}</div>
                    <div className="mt-1 font-medium">{formatDate(selected.lastLogin)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
    </StaffOnly>
  );
}
