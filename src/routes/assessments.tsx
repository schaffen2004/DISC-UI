import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Loader2, Lock, MoreHorizontal, Plus, Unlock } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  type DiscSessionStatus,
} from "@/lib/api/disc";
import { participantStatusMessageKey, sessionStatusMessageKey, useT } from "@/lib/i18n";

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
  const { isAuthenticated, isLoading: authLoading, isStaff, role, user } = useAuth();
  const t = useT();
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
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {t("assessments.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role?.toUpperCase() === "OPERATOR"
              ? t("assessments.subtitleOperator")
              : t("assessments.subtitleAll")}
          </p>
        </div>
        {isStaff && (
          <Button size="sm" asChild>
            <Link to="/assessments/new">
              <Plus className="h-4 w-4" />
              {t("assessments.new")}
            </Link>
          </Button>
        )}
      </header>

      {!isAuthenticated && !authLoading && (
        <Card className="p-6 text-sm text-muted-foreground">
          {t("assessments.signInPrompt").split("{link}")[0]}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("assessments.signInLink")}
          </Link>
          {t("assessments.signInPrompt").split("{link}")[1]}
        </Card>
      )}

      {(authLoading || (isAuthenticated && isLoading)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("assessments.loading")}
        </div>
      )}

      {isError && (
        <Card className="p-6 space-y-3">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load sessions"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("common.retry")}
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
          {t("assessments.empty")}
        </Card>
      )}

      {isAuthenticated && !isLoading && !isError && sessions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((a) => {
            // OPEN sessions are open enrollment — Take even before myParticipant exists (API auto-joins).
            const canTake =
              a.status === "OPEN" &&
              (!a.myParticipant ||
                (a.myParticipant.status !== "SUBMITTED" && a.myParticipant.status !== "VERIFIED"));
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
                      {t(sessionStatusMessageKey(a.status))}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    {t(
                      a.participantCount === 1
                        ? "assessments.participants"
                        : "assessments.participants_plural",
                      { count: a.participantCount },
                    )}
                    {a.myParticipant
                      ? ` · ${t("assessments.youStatus", {
                          status: t(participantStatusMessageKey(a.myParticipant.status)),
                        })}`
                      : ""}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex -space-x-2">
                      {a.participantCount === 0 ? (
                        <div className="grid h-7 place-items-center rounded-full border border-dashed px-2 text-[10px] text-muted-foreground">
                          Open to all
                        </div>
                      ) : (
                        <>
                          {Array.from({ length: Math.min(4, a.participantCount) }).map((_, i) => (
                            <Avatar key={i} className="h-7 w-7 border-2 border-background">
                              <AvatarFallback className="bg-muted text-[10px]">
                                {String.fromCharCode(65 + i)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {a.participantCount > 4 && (
                            <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                              +{a.participantCount - 4}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {manage && (
                        <Button variant="outline" size="sm" onClick={() => openDetails(a.id)}>
                          <Eye className="h-4 w-4" />
                          {t("common.details")}
                        </Button>
                      )}
                      {canTake && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/assessments/questionnaire" search={{ sessionId: a.id }}>
                            {t("common.take")}
                          </Link>
                        </Button>
                      )}
                      {canViewResult && a.myParticipant && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            to="/assessments/result"
                            search={{ participantId: a.myParticipant.id }}
                          >
                            {t("common.result")}
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
                          {a.status === "CLOSED" ? t("common.reopen") : t("common.open")}
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
                          {t("common.close")}
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
                              {t("common.viewDetails")}
                            </DropdownMenuItem>
                            {canOpen && (
                              <DropdownMenuItem onClick={() => onChangeStatus(a, "OPEN")}>
                                {a.status === "CLOSED"
                                  ? t("assessments.reopenSession")
                                  : t("assessments.openSession")}
                              </DropdownMenuItem>
                            )}
                            {canClose && (
                              <DropdownMenuItem onClick={() => onChangeStatus(a, "CLOSED")}>
                                {t("assessments.closeSession")}
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
            <DialogTitle>{selectedSession?.title ?? t("assessments.sessionDetails")}</DialogTitle>
            <DialogDescription>{t("assessments.sessionDetailsDesc")}</DialogDescription>
          </DialogHeader>

          {overviewQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("assessments.loadingDetails")}
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
                  {t(sessionStatusMessageKey(overviewQuery.data.status))}
                </Badge>
              </div>

              {overviewQuery.data.description && (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  {overviewQuery.data.description}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem
                  label={t("assessments.participantsLabel")}
                  value={String(overviewQuery.data.participantCount)}
                />
                <InfoItem
                  label={t("assessments.owner")}
                  value={overviewQuery.data.owner?.email ?? "—"}
                />
                <InfoItem
                  label={t("assessments.created")}
                  value={formatDateTime(overviewQuery.data.createdAt)}
                />
                <InfoItem
                  label={t("assessments.opened")}
                  value={formatDateTime(overviewQuery.data.openedAt)}
                />
                <InfoItem
                  label={t("assessments.closed")}
                  value={formatDateTime(overviewQuery.data.closedAt)}
                />
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">
                  {t("assessments.participantsStatus")}
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {overviewQuery.data.participants.map((participant) => {
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
                            {t(participantStatusMessageKey(participant.status))}
                          </Badge>
                          {canViewResult && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                to="/assessments/result"
                                search={{ participantId: participant.id }}
                              >
                                {t("common.result")}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {overviewQuery.data.participants.length === 0 && (
                    <p className="text-muted-foreground">{t("assessments.noParticipants")}</p>
                  )}
                </div>
              </div>

              {(() => {
                const myRow = overviewQuery.data.participants.find((p) => p.user.id === user?.id);
                const canTakeSelf =
                  overviewQuery.data.status === "OPEN" &&
                  (!myRow || (myRow.status !== "SUBMITTED" && myRow.status !== "VERIFIED"));
                const canManage = canManageStatus(overviewQuery.data);
                if (!canTakeSelf && !canManage) return null;
                return (
                  <div className="flex flex-wrap justify-end gap-2">
                    {canTakeSelf && (
                      <Button asChild>
                        <Link
                          to="/assessments/questionnaire"
                          search={{ sessionId: overviewQuery.data.id }}
                        >
                          {t("common.take")}
                        </Link>
                      </Button>
                    )}
                    {canManage &&
                      (overviewQuery.data.status === "DRAFT" ||
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
                          {overviewQuery.data.status === "CLOSED"
                            ? t("assessments.reopenSession")
                            : t("assessments.openSession")}
                        </Button>
                      )}
                    {canManage && overviewQuery.data.status === "OPEN" && (
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
                        {t("assessments.closeSession")}
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
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
