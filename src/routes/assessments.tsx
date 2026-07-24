import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Lock, MoreHorizontal, Plus, Search, Unlock, UserPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import {
  closeSession,
  filterSessionsForRole,
  getSessionOverview,
  listSessions,
  openSession,
  participantStatusLabel,
  sessionStatusLabel,
  updateSessionParticipants,
  type DiscSessionOverview,
  type DiscSessionStatus,
} from "@/lib/api/disc";
import { listUsers, userDisplayName, userInitials, type UserListItem } from "@/lib/api/users";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments — DigiWork" },
      { name: "description", content: "Manage DISC assessment campaigns and completions." },
    ],
  }),
  component: AssessmentsLayout,
});

const statusStyle: Record<DiscSessionStatus, string> = {
  OPEN: "bg-primary/10 text-primary border-primary/25",
  DRAFT: "bg-muted text-muted-foreground",
  CLOSED: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
};

function AssessmentsLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isChild = path !== "/assessments";
  if (isChild) return <Outlet />;

  return (
    <AppShell>
      <AssessmentsPage />
    </AppShell>
  );
}

function AssessmentsPage() {
  const { isAuthenticated, isLoading: authLoading, isStaff, role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const {
    data: allSessions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["disc", "sessions"],
    queryFn: listSessions,
    enabled: isAuthenticated,
  });
  const sessions = useMemo(() => filterSessionsForRole(allSessions, role), [allSessions, role]);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const overviewQuery = useQuery({
    queryKey: ["disc", "session", selectedSessionId, "overview"],
    queryFn: () => getSessionOverview(selectedSessionId!),
    enabled: Boolean(selectedSessionId) && isAuthenticated,
  });
  const statusMutation = useMutation({
    mutationFn: async ({
      sessionId,
      nextStatus,
    }: {
      sessionId: string;
      nextStatus: "OPEN" | "CLOSED";
    }) => {
      if (nextStatus === "OPEN") return openSession(sessionId);
      return closeSession(sessionId);
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["disc", "session", variables.sessionId, "overview"],
        }),
      ]);
    },
  });

  /** ADMIN / OPERATOR who own the session can open (incl. reopen) or close. */
  const canManageStatus = (session: { isManager?: boolean }) =>
    Boolean(isStaff && session.isManager);

  const openDetails = (sessionId: string) => setSelectedSessionId(sessionId);
  const onChangeStatus = (session: { id: string }, nextStatus: "OPEN" | "CLOSED") => {
    statusMutation.mutate({ sessionId: session.id, nextStatus });
  };

  const statusError =
    statusMutation.error instanceof ApiError || statusMutation.error instanceof Error
      ? statusMutation.error.message
      : statusMutation.isError
        ? "Failed to update session status"
        : null;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role?.toUpperCase() === "OPERATOR"
              ? "Sessions you created or were invited to."
              : "Assessment campaigns across your organization."}
          </p>
        </div>
        {isStaff && (
          <Button size="sm" asChild>
            <Link to="/assessments/new">
              <Plus className="h-4 w-4" />
              New Assessment
            </Link>
          </Button>
        )}
      </header>

      {!isAuthenticated && !authLoading && (
        <Card className="p-6 text-sm text-muted-foreground">
          Please{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            sign in
          </Link>{" "}
          to load assessments from the API.
        </Card>
      )}

      {(authLoading || (isAuthenticated && isLoading)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions…
        </div>
      )}

      {isError && (
        <Card className="p-6 space-y-3">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load sessions"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      )}

      {statusError && (
        <Card className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {statusError}
        </Card>
      )}

      {isAuthenticated && !isLoading && !isError && sessions.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No assessment sessions yet. Create one to get started.
        </Card>
      )}

      {isAuthenticated && !isLoading && !isError && sessions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((a) => {
            const canTake =
              !a.isManager &&
              a.status === "OPEN" &&
              a.myParticipant &&
              a.myParticipant.status !== "SUBMITTED" &&
              a.myParticipant.status !== "VERIFIED";
            // Only show Result when the invitee has a scored status (list API has no result field).
            // INVITED / IN_PROGRESS — even on CLOSED sessions — means no result yet.
            const canViewResult =
              a.myParticipant &&
              (a.myParticipant.status === "SUBMITTED" || a.myParticipant.status === "VERIFIED");
            const manage = canManageStatus(a);
            const canOpen = manage && (a.status === "DRAFT" || a.status === "CLOSED");
            const canClose = manage && a.status === "OPEN";

            const isUpdating =
              statusMutation.isPending && statusMutation.variables?.sessionId === a.id;

            return (
              <Card key={a.id} className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground truncate">
                        {a.id.slice(0, 8)}
                      </div>
                      <CardTitle className="mt-1 truncate text-base">{a.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={statusStyle[a.status]}>
                      {sessionStatusLabel[a.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    {a.participantCount} participant{a.participantCount === 1 ? "" : "s"}
                    {a.myParticipant
                      ? ` · You: ${participantStatusLabel[a.myParticipant.status]}`
                      : ""}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex -space-x-2">
                      {Array.from({ length: Math.min(4, Math.max(1, a.participantCount)) }).map(
                        (_, i) => (
                          <Avatar key={i} className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="bg-muted text-[10px]">
                              {String.fromCharCode(65 + i)}
                            </AvatarFallback>
                          </Avatar>
                        ),
                      )}
                      {a.participantCount > 4 && (
                        <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                          +{a.participantCount - 4}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {manage && (
                        <Button variant="outline" size="sm" onClick={() => openDetails(a.id)}>
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      )}
                      {canTake && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/assessments/questionnaire" search={{ sessionId: a.id }}>
                            Take
                          </Link>
                        </Button>
                      )}
                      {canViewResult && a.myParticipant && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            to="/assessments/result"
                            search={{ participantId: a.myParticipant.id }}
                          >
                            Result
                          </Link>
                        </Button>
                      )}
                      {canOpen && (
                        <Button
                          size="sm"
                          onClick={() => onChangeStatus(a, "OPEN")}
                          disabled={isUpdating}
                        >
                          {isUpdating && statusMutation.variables?.nextStatus === "OPEN" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Unlock className="h-4 w-4" />
                          )}
                          {a.status === "CLOSED" ? "Reopen" : "Open"}
                        </Button>
                      )}
                      {canClose && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onChangeStatus(a, "CLOSED")}
                          disabled={isUpdating}
                        >
                          {isUpdating && statusMutation.variables?.nextStatus === "CLOSED" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                          Close
                        </Button>
                      )}
                      {manage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isUpdating}
                            >
                              {isUpdating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(a.id)}>
                              View details
                            </DropdownMenuItem>
                            {canOpen && (
                              <DropdownMenuItem onClick={() => onChangeStatus(a, "OPEN")}>
                                {a.status === "CLOSED" ? "Reopen session" : "Open session"}
                              </DropdownMenuItem>
                            )}
                            {canClose && (
                              <DropdownMenuItem onClick={() => onChangeStatus(a, "CLOSED")}>
                                Close session
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selectedSessionId)}
        onOpenChange={(open) => !open && setSelectedSessionId(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedSession?.title ?? "Session details"}</DialogTitle>
            <DialogDescription>Basic information and current session state.</DialogDescription>
          </DialogHeader>

          {overviewQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading session details…
            </div>
          ) : overviewQuery.isError ? (
            <p className="text-sm text-destructive">
              {overviewQuery.error instanceof Error
                ? overviewQuery.error.message
                : "Failed to load session details"}
            </p>
          ) : overviewQuery.data ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{overviewQuery.data.title}</div>
                  <div className="text-xs text-muted-foreground">ID: {overviewQuery.data.id}</div>
                </div>
                <Badge variant="outline" className={statusStyle[overviewQuery.data.status]}>
                  {sessionStatusLabel[overviewQuery.data.status]}
                </Badge>
              </div>

              {overviewQuery.data.description && (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  {overviewQuery.data.description}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem
                  label="Participants"
                  value={String(overviewQuery.data.participantCount)}
                />
                <InfoItem label="Owner" value={overviewQuery.data.owner?.email ?? "—"} />
                <InfoItem label="Created" value={formatDateTime(overviewQuery.data.createdAt)} />
                <InfoItem label="Opened" value={formatDateTime(overviewQuery.data.openedAt)} />
                <InfoItem label="Closed" value={formatDateTime(overviewQuery.data.closedAt)} />
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">Participants status</div>
                <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {overviewQuery.data.participants.map((participant) => {
                    const canVerify = participant.status === "SUBMITTED";
                    const canViewResult =
                      Boolean(participant.result) ||
                      participant.status === "SUBMITTED" ||
                      participant.status === "VERIFIED";
                    return (
                      <div
                        key={participant.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-muted-foreground">
                            {participant.user.email}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">
                            {participantStatusLabel[participant.status]}
                          </Badge>
                          {canVerify && (
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                to="/assessments/verify"
                                search={{
                                  sessionId: overviewQuery.data.id,
                                  participantId: participant.id,
                                }}
                              >
                                Verify
                              </Link>
                            </Button>
                          )}
                          {canViewResult && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                to="/assessments/result"
                                search={{ participantId: participant.id }}
                              >
                                Result
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {overviewQuery.data.participants.length === 0 && (
                    <p className="text-muted-foreground">No participants assigned.</p>
                  )}
                </div>
              </div>

              {canManageStatus(overviewQuery.data) && overviewQuery.data.status === "OPEN" && (
                <InviteParticipantsPanel session={overviewQuery.data} />
              )}

              {canManageStatus(overviewQuery.data) && (
                <div className="flex flex-wrap justify-end gap-2">
                  {(overviewQuery.data.status === "DRAFT" ||
                    overviewQuery.data.status === "CLOSED") && (
                    <Button
                      onClick={() => onChangeStatus(overviewQuery.data, "OPEN")}
                      disabled={statusMutation.isPending}
                    >
                      {statusMutation.isPending &&
                      statusMutation.variables?.nextStatus === "OPEN" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlock className="h-4 w-4" />
                      )}
                      {overviewQuery.data.status === "CLOSED" ? "Reopen session" : "Open session"}
                    </Button>
                  )}
                  {overviewQuery.data.status === "OPEN" && (
                    <Button
                      variant="outline"
                      onClick={() => onChangeStatus(overviewQuery.data, "CLOSED")}
                      disabled={statusMutation.isPending}
                    >
                      {statusMutation.isPending &&
                      statusMutation.variables?.nextStatus === "CLOSED" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      Close session
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteParticipantsPanel({ session }: { session: DiscSessionOverview }) {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, UserListItem>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // Reset selection when switching sessions
  useEffect(() => {
    setSelected({});
    setQ("");
    setSearch("");
    setFormError(null);
  }, [session.id]);

  const existingUserIds = useMemo(
    () => new Set(session.participants.map((p) => p.user.id)),
    [session.participants],
  );

  const usersQuery = useQuery({
    queryKey: ["users", "all", "invite", session.id, { search }],
    queryFn: () => listUsers({ search, page: 1, limit: 100 }),
    enabled: isAuthenticated,
  });

  const candidates = useMemo(() => {
    const list = usersQuery.data?.data ?? [];
    return list.filter((u) => u.id !== user?.id && !existingUserIds.has(u.id));
  }, [usersQuery.data, user?.id, existingUserIds]);

  const selectedIds = Object.keys(selected);

  const inviteMutation = useMutation({
    mutationFn: (participantIds: string[]) => updateSessionParticipants(session.id, participantIds),
    onSuccess: async () => {
      setSelected({});
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["disc", "session", session.id, "overview"],
        }),
      ]);
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Failed to invite participants",
      );
    },
  });

  const toggleUser = (userItem: UserListItem, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (on) next[userItem.id] = userItem;
      else delete next[userItem.id];
      return next;
    });
  };

  const onInvite = () => {
    setFormError(null);
    if (selectedIds.length === 0) {
      setFormError("Select at least one person to invite.");
      return;
    }
    inviteMutation.mutate(selectedIds);
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <div className="text-sm font-medium">Invite participants</div>
      </div>
      <p className="text-xs text-muted-foreground">
        Session is open — add more invitees without removing existing participants.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search users by name, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {usersQuery.isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      )}

      {usersQuery.isError && (
        <p className="text-sm text-destructive">
          {(usersQuery.error as Error)?.message || "Failed to load users"}
        </p>
      )}

      {!usersQuery.isLoading && !usersQuery.isError && candidates.length === 0 && (
        <p className="py-2 text-center text-sm text-muted-foreground">No more users to invite.</p>
      )}

      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {candidates.map((u) => {
          const isOn = Boolean(selected[u.id]);
          return (
            <label
              key={u.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors",
                isOn ? "border-primary bg-primary/5" : "hover:bg-muted/40",
              )}
            >
              <Checkbox checked={isOn} onCheckedChange={(v) => toggleUser(u, Boolean(v))} />
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                  {userInitials(u)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{userDisplayName(u)}</div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              </div>
            </label>
          );
        })}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
        <Button
          size="sm"
          onClick={onInvite}
          disabled={inviteMutation.isPending || selectedIds.length === 0}
        >
          {inviteMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Invite
        </Button>
      </div>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium break-all">{value}</div>
    </div>
  );
}
