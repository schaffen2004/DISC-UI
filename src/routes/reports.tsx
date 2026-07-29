import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Loader2, Search, Users, Calendar, FileText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DiscBadge } from "@/components/disc-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  getMyHistory,
  listSessions,
  topDimension,
  type DiscParticipantStatus,
  type DiscScoreResult,
  type DiscSessionStatus,
} from "@/lib/api/disc";
import { participantStatusMessageKey, sessionStatusMessageKey, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — DigiWork" },
      { name: "description", content: "DISC assessment reports." },
    ],
  }),
  component: ReportsLayout,
});

function EmptyAssessmentsNotice({
  title = "Chưa có bài đánh giá",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileText className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

const sessionStatusStyle: Record<DiscSessionStatus, string> = {
  OPEN: "bg-primary/10 text-primary border-primary/25",
  DRAFT: "bg-muted text-muted-foreground",
  CLOSED: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
};

const participantStatusStyle: Record<DiscParticipantStatus, string> = {
  INVITED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/25",
  SUBMITTED: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/25",
  VERIFIED: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function topScore(result?: DiscScoreResult | null) {
  if (!result) return null;
  return Math.round(
    Math.max(result.D_percent, result.I_percent, result.S_percent, result.C_percent),
  );
}

function ReportsLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (path !== "/reports") return <Outlet />;
  return (
    <AppShell>
      <ReportsPage />
    </AppShell>
  );
}

function ReportsPage() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffReportsPage /> : <MyReportsPage />;
}

function StaffReportsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useT();
  const [q, setQ] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["disc", "sessions"],
    queryFn: listSessions,
    enabled: isAuthenticated,
  });

  const allManaged = useMemo(
    () => (sessionsQuery.data ?? []).filter((s) => s.isManager),
    [sessionsQuery.data],
  );

  const sessions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allManaged;
    return allManaged.filter(
      (s) =>
        s.title.toLowerCase().includes(term) || (s.description ?? "").toLowerCase().includes(term),
    );
  }, [allManaged, q]);

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Session reports for assessments you manage.
        </p>
      </header>

      {!isAuthenticated && !authLoading && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to load session reports.
        </Card>
      )}

      {(authLoading || (isAuthenticated && sessionsQuery.isLoading)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
        </div>
      )}

      {sessionsQuery.isError && (
        <Card className="p-4 text-sm text-destructive">
          {(sessionsQuery.error as Error)?.message || "Failed to load sessions"}
        </Card>
      )}

      {isAuthenticated &&
        !sessionsQuery.isLoading &&
        !sessionsQuery.isError &&
        (allManaged.length === 0 ? (
          <EmptyAssessmentsNotice
            description="Chưa có bài đánh giá nào được tạo. Tạo assessment mới để bắt đầu theo dõi báo cáo."
            action={
              <Button asChild size="sm">
                <Link to="/assessments/new">Tạo bài đánh giá</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Card className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions…"
                  className="pl-8"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </Card>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-4">Session</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participants</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          Không tìm thấy bài đánh giá phù hợp.
                        </TableCell>
                      </TableRow>
                    )}
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{s.title}</div>
                            {s.description && (
                              <div className="truncate text-xs text-muted-foreground">
                                {s.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("font-medium", sessionStatusStyle[s.status])}
                          >
                            {t(sessionStatusMessageKey(s.status))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {s.participantCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(s.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="outline" size="sm">
                            <Link to="/reports/$id" params={{ id: s.id }}>
                              Open
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        ))}
    </div>
  );
}

function MyReportsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useT();
  const [q, setQ] = useState("");

  const historyQuery = useQuery({
    queryKey: ["disc", "history", "me"],
    queryFn: getMyHistory,
    enabled: isAuthenticated,
  });

  const allHistory = historyQuery.data ?? [];
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allHistory;
    return allHistory.filter(
      (h) => h.session.title.toLowerCase().includes(term) || h.status.toLowerCase().includes(term),
    );
  }, [allHistory, q]);

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">My reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only your personal DISC results are shown here.
        </p>
      </header>

      {!isAuthenticated && !authLoading && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to load your reports.
        </Card>
      )}

      {(authLoading || (isAuthenticated && historyQuery.isLoading)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your reports…
        </div>
      )}

      {historyQuery.isError && (
        <Card className="p-4 text-sm text-destructive">
          {(historyQuery.error as Error)?.message || "Failed to load reports"}
        </Card>
      )}

      {isAuthenticated &&
        !historyQuery.isLoading &&
        !historyQuery.isError &&
        (allHistory.length === 0 ? (
          <EmptyAssessmentsNotice
            description="Bạn chưa có bài đánh giá nào. Khi được giao bài DISC, báo cáo sẽ xuất hiện tại đây."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/assessments">Xem assessments</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Card className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search your reports…"
                  className="pl-8"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-4">Session</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>DISC</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          Không tìm thấy bài đánh giá phù hợp.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((h) => {
                      const disc = topDimension(h.result);
                      const score = topScore(h.result);
                      return (
                        <TableRow key={h.participantId}>
                          <TableCell className="pl-4">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{h.session.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(h.session.createdAt)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("font-medium", participantStatusStyle[h.status])}
                            >
                              {t(participantStatusMessageKey(h.status))}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {disc ? (
                              <DiscBadge type={disc} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">{score ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(h.submittedAt)}
                          </TableCell>
                          <TableCell>
                            {h.result ? (
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  to="/assessments/result"
                                  search={{ participantId: h.participantId }}
                                >
                                  Open
                                </Link>
                              </Button>
                            ) : (
                              <Button asChild variant="ghost" size="sm">
                                <Link
                                  to="/assessments/questionnaire"
                                  search={{ sessionId: h.session.id }}
                                >
                                  Continue
                                </Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        ))}
    </div>
  );
}
