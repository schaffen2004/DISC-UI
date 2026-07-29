import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  UserPlus,
  Download,
  ArrowRight,
  Sparkles,
  PlayCircle,
  Target,
  Loader2,
  FileText,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { DiscBadge } from "@/components/disc-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  getMyHistory,
  getSessionOverview,
  listSessions,
  filterSessionsForRole,
  topDimension,
  type DiscHistoryItem,
  type DiscScoreResult,
  type DiscSessionListItem,
} from "@/lib/api/disc";
import { participantStatusMessageKey, sessionStatusMessageKey, useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — DigiWork" },
      { name: "description", content: "Overview of assessments, employees, and DISC insights." },
    ],
  }),
  component: DashboardPage,
});

function monthKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

function buildSessionTrend(sessions: DiscSessionListItem[]) {
  const now = new Date();
  const buckets: Array<{
    key: string;
    created: number;
    open: number;
    closed: number;
    participants: number;
  }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, created: 0, open: 0, closed: 0, participants: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const s of sessions) {
    const key = monthKey(s.createdAt);
    if (!key) continue;
    const b = map.get(key);
    if (!b) continue;
    b.created += 1;
    b.participants += s.participantCount ?? 0;
    if (s.status === "OPEN") b.open += 1;
    if (s.status === "CLOSED") b.closed += 1;
  }
  return buckets.map((b) => ({
    month: monthLabel(b.key),
    created: b.created,
    open: b.open,
    closed: b.closed,
    participants: b.participants,
  }));
}

function buildStatusDistribution(sessions: DiscSessionListItem[]) {
  const counts = { DRAFT: 0, OPEN: 0, CLOSED: 0 };
  for (const s of sessions) counts[s.status] += 1;
  return [
    { type: "OPEN", label: "Active", value: counts.OPEN, color: "var(--primary)" },
    { type: "CLOSED", label: "Closed", value: counts.CLOSED, color: "var(--disc-s)" },
    { type: "DRAFT", label: "Draft", value: counts.DRAFT, color: "var(--muted-foreground)" },
  ].filter((d) => d.value > 0);
}

function buildDiscDistribution(results: Array<DiscScoreResult | null | undefined>) {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  for (const r of results) {
    const t = topDimension(r);
    if (t) counts[t] += 1;
  }
  const total = counts.D + counts.I + counts.S + counts.C;
  return (["D", "I", "S", "C"] as const).map((type) => ({
    type,
    label: type,
    value: total ? Math.round((counts[type] / total) * 100) : 0,
    count: counts[type],
    color: `var(--disc-${type.toLowerCase()})`,
  }));
}

function isPendingParticipant(status?: string) {
  return status === "INVITED" || status === "IN_PROGRESS";
}

function isDoneParticipant(status?: string) {
  return status === "SUBMITTED" || status === "VERIFIED";
}

function useDiscDashboard() {
  const { isAuthenticated, isStaff, role } = useAuth();
  const sessionsQuery = useQuery({
    queryKey: ["disc", "sessions"],
    queryFn: listSessions,
    enabled: isAuthenticated,
  });
  const historyQuery = useQuery({
    queryKey: ["disc", "history", "me"],
    queryFn: getMyHistory,
    enabled: isAuthenticated,
  });

  const sessions = useMemo(
    () => filterSessionsForRole(sessionsQuery.data ?? [], role),
    [sessionsQuery.data, role],
  );
  const managedIds = useMemo(
    () =>
      isStaff
        ? sessions
            .filter((s) => s.isManager && (s.status === "OPEN" || s.status === "CLOSED"))
            .slice(0, 10)
            .map((s) => s.id)
        : [],
    [sessions, isStaff],
  );

  const overviewQueries = useQueries({
    queries: managedIds.map((id) => ({
      queryKey: ["disc", "session", id, "overview"],
      queryFn: () => getSessionOverview(id),
      enabled: isAuthenticated && isStaff && Boolean(id),
    })),
  });

  const teamDiscResults = useMemo(() => {
    const results: (DiscScoreResult | null)[] = [];
    for (const q of overviewQueries) {
      for (const p of q.data?.participants ?? []) {
        if (p.result) results.push(p.result);
      }
    }
    return results;
  }, [overviewQueries]);

  return {
    isAuthenticated,
    isStaff,
    sessions,
    history: historyQuery.data ?? [],
    isLoading: isAuthenticated && (sessionsQuery.isLoading || historyQuery.isLoading),
    teamDiscResults,
    overviewsLoading: overviewQueries.some((q) => q.isLoading),
  };
}

function DashboardPage() {
  return (
    <AppShell>
      <HomeDashboard />
    </AppShell>
  );
}

function HomeDashboard() {
  const { isStaff } = useAuth();
  const data = useDiscDashboard();
  if (!isStaff) return <EmployeeDashboard {...data} />;
  return <StaffDashboard {...data} />;
}

type DashboardData = ReturnType<typeof useDiscDashboard>;

function EmployeeDashboard({ isAuthenticated, sessions, history, isLoading }: DashboardData) {
  const { displayName } = useAuth();
  const t = useT();
  const firstName = displayName.split(/\s+/)[0] || "there";

  const mySessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          Boolean(s.myParticipant) ||
          (s.status === "OPEN" && !isDoneParticipant(s.myParticipant?.status)),
      ),
    [sessions],
  );
  const pending = mySessions.filter(
    (s) =>
      (s.status === "OPEN" && !s.myParticipant) || isPendingParticipant(s.myParticipant?.status),
  );
  const completed = mySessions.filter((s) => isDoneParticipant(s.myParticipant?.status));
  const withResult = history.filter((h) => h.result);
  const latestReports = withResult.slice(0, 5);
  const activePending = pending[0];
  const latestResult = withResult[0];

  const statusPie = useMemo(() => {
    const counts = { pending: 0, done: 0, other: 0 };
    for (const s of mySessions) {
      const st = s.myParticipant?.status;
      if ((s.status === "OPEN" && !st) || isPendingParticipant(st)) counts.pending += 1;
      else if (isDoneParticipant(st)) counts.done += 1;
      else counts.other += 1;
    }
    return [
      { type: "pending", label: "Pending", value: counts.pending, color: "var(--warning)" },
      { type: "done", label: "Completed", value: counts.done, color: "var(--disc-s)" },
      { type: "other", label: "Other", value: counts.other, color: "var(--muted-foreground)" },
    ].filter((d) => d.value > 0);
  }, [mySessions]);

  const scoreBars = useMemo(() => {
    const r = latestResult?.result;
    if (!r) return [];
    return (["D", "I", "S", "C"] as const).map((type) => ({
      type,
      value: Math.round(r[`${type}_percent`] ?? 0),
      color: `var(--disc-${type.toLowerCase()})`,
    }));
  }, [latestResult]);

  const dominant = topDimension(latestResult?.result);

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          My overview
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
          Good morning, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal assessments and DISC results only.
        </p>
      </header>

      {!isAuthenticated && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to load your dashboard.
        </Card>
      )}

      {activePending && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <Badge variant="secondary" className="gap-1.5 border">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Pending for you
                </Badge>
                <h2 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight">
                  {activePending.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activePending.myParticipant
                    ? t(participantStatusMessageKey(activePending.myParticipant.status))
                    : t("assessments.availableToTake")}{" "}
                  · {t(sessionStatusMessageKey(activePending.status))}
                  {pending.length > 1 ? ` · +${pending.length - 1} more` : ""}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/assessments/questionnaire" search={{ sessionId: activePending.id }}>
                      <PlayCircle className="h-4 w-4" />
                      {activePending.myParticipant ? "Continue assessment" : "Take assessment"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/assessments">View all</Link>
                  </Button>
                </div>
              </div>
              <div className="hidden sm:grid h-24 w-24 place-items-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                <Target className="h-10 w-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your data…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned to me" value={mySessions.length} icon={Users} accent="primary" />
        <StatCard label="Pending" value={pending.length} icon={Clock} accent="warning" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} accent="success" />
        <StatCard label="My results" value={withResult.length} icon={FileText} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My DISC profile</CardTitle>
            <CardDescription>
              {latestResult
                ? `Latest result from “${latestResult.session.title}”`
                : "Scores from your most recent assessment"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scoreBars.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Chưa có kết quả DISC. Hoàn thành bài đánh giá để xem hồ sơ.
              </p>
            ) : (
              <div className="space-y-4">
                {dominant && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Dominant type</span>
                    <DiscBadge type={dominant} showLabel />
                  </div>
                )}
                <div className="h-[220px]">
                  <ResponsiveContainer>
                    <BarChart data={scoreBars} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="type"
                        tickLine={false}
                        axisLine={false}
                        className="text-xs"
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        className="text-xs"
                        stroke="var(--muted-foreground)"
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {scoreBars.map((d) => (
                          <Cell key={d.type} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My status</CardTitle>
            <CardDescription>Your assessment progress</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Chưa được gán bài đánh giá.
              </p>
            ) : (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="var(--background)"
                        strokeWidth={2}
                      >
                        {statusPie.map((d) => (
                          <Cell key={d.type} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                  {statusPie.map((d) => (
                    <div key={d.type} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="ml-auto font-semibold tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Shortcuts for your assessments</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Link
            to="/assessments"
            className="flex items-center gap-3 rounded-lg border p-3 card-hover"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">My assessments</div>
              <div className="text-xs text-muted-foreground">
                View and complete assigned sessions
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link to="/reports" className="flex items-center gap-3 rounded-lg border p-3 card-hover">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--warning)]/15 text-[var(--warning)]">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">My reports</div>
              <div className="text-xs text-muted-foreground">View your personal DISC results</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My assessments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/assessments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {mySessions.slice(0, 5).map((s) => (
              <MyAssessmentRow key={s.id} session={s} />
            ))}
            {mySessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No assessments assigned to you.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My reports</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y">
            {latestReports.map((r) => (
              <LatestReportRow key={r.participantId} item={r} />
            ))}
            {latestReports.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No scored results yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Separator className="opacity-0" />
    </div>
  );
}

function StaffDashboard({
  isAuthenticated,
  sessions,
  history,
  isLoading,
  teamDiscResults,
  overviewsLoading,
}: DashboardData) {
  const { displayName } = useAuth();
  const t = useT();
  const firstName = displayName.split(/\s+/)[0] || "there";

  const openSessions = sessions.filter((s) => s.status === "OPEN");
  const closedSessions = sessions.filter((s) => s.status === "CLOSED");
  const draftSessions = sessions.filter((s) => s.status === "DRAFT");
  const withResult = history.filter((h) => h.result);
  const latestReports = withResult.slice(0, 5);
  const upcoming = openSessions.slice(0, 4);

  const sessionTrend = useMemo(() => buildSessionTrend(sessions), [sessions]);
  const statusPie = useMemo(() => buildStatusDistribution(sessions), [sessions]);
  const discPie = useMemo(() => buildDiscDistribution(teamDiscResults), [teamDiscResults]);
  const hasDiscData = discPie.some((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Overview
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Good morning, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's a snapshot of your DISC assessment activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" asChild>
            <Link to="/assessments/new">
              <Plus className="h-4 w-4" />
              New Assessment
            </Link>
          </Button>
        </div>
      </header>

      {!isAuthenticated && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to load live dashboard data.
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading live stats…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sessions" value={sessions.length} icon={Users} accent="primary" />
        <StatCard
          label="Completed"
          value={closedSessions.length}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard label="Active" value={openSessions.length} icon={Clock} accent="warning" />
        <StatCard label="Drafts" value={draftSessions.length} icon={TrendingUp} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Session activity</CardTitle>
              <CardDescription>Sessions created in the last 6 months</CardDescription>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Created
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Closed
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No session data yet.
              </p>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer>
                  <AreaChart data={sessionTrend} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="closed"
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.4}
                      fill="transparent"
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      fill="url(#fillCreated)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session status</CardTitle>
            <CardDescription>Live breakdown of your sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="var(--background)"
                        strokeWidth={2}
                      >
                        {statusPie.map((d) => (
                          <Cell key={d.type} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {statusPie.map((d) => (
                    <div key={d.type} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="ml-auto font-semibold tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Participants by month</CardTitle>
            <CardDescription>Total assignees on sessions created each month</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No participant data yet.
              </p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer>
                  <BarChart data={sessionTrend} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="participants" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DISC distribution</CardTitle>
            <CardDescription>Dominant profiles from managed sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading DISC…
              </div>
            ) : !hasDiscData ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Chưa có kết quả DISC để hiển thị.
              </p>
            ) : (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={discPie.filter((d) => d.count > 0)}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        stroke="var(--background)"
                        strokeWidth={2}
                      >
                        {discPie
                          .filter((d) => d.count > 0)
                          .map((d) => (
                            <Cell key={d.type} fill={d.color} />
                          ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {discPie.map((d) => (
                    <div key={d.type} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="ml-auto font-semibold tabular-nums">
                        {d.count} · {d.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Common shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/assessments/new"
            className="flex items-center gap-3 rounded-lg border p-3 card-hover"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Create Assessment</div>
              <div className="text-xs text-muted-foreground">Assign a new DISC round</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/employees"
            className="flex items-center gap-3 rounded-lg border p-3 card-hover"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--success)]/10 text-[var(--success)]">
              <UserPlus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Invite Employee</div>
              <div className="text-xs text-muted-foreground">Add teammates to your workspace</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link to="/reports" className="flex items-center gap-3 rounded-lg border p-3 card-hover">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--warning)]/15 text-[var(--warning)]">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Export Reports</div>
              <div className="text-xs text-muted-foreground">Download PDFs & CSVs</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/assessments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessions.slice(0, 5).map((s) => (
              <SessionActivityRow key={s.id} session={s} />
            ))}
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming assessments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/assessments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((u) => (
              <div key={u.id} className="rounded-lg border p-3 card-hover">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.participantCount} participants · {t(sessionStatusMessageKey(u.status))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/assessments">Manage</Link>
                  </Button>
                </div>
              </div>
            ))}
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No active sessions.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest reports</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y">
            {latestReports.map((r) => (
              <LatestReportRow key={r.participantId} item={r} />
            ))}
            {latestReports.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No scored results yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Separator className="opacity-0" />
    </div>
  );
}

function MyAssessmentRow({ session }: { session: DiscSessionListItem }) {
  const t = useT();
  const status = session.myParticipant?.status;
  const canTake = session.status === "OPEN" && (!status || isPendingParticipant(status));
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted text-xs">
          {session.title.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{session.title}</div>
        <div className="text-xs text-muted-foreground">
          {status
            ? t(participantStatusMessageKey(status))
            : t(sessionStatusMessageKey(session.status))}{" "}
          · {new Date(session.createdAt).toLocaleDateString()}
        </div>
      </div>
      {canTake ? (
        <Button variant="outline" size="sm" asChild>
          <Link to="/assessments/questionnaire" search={{ sessionId: session.id }}>
            {status ? "Continue" : "Take"}
          </Link>
        </Button>
      ) : session.myParticipant?.id && isDoneParticipant(status) ? (
        <Button variant="ghost" size="sm" asChild>
          <Link to="/assessments/result" search={{ participantId: session.myParticipant.id }}>
            Result
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function SessionActivityRow({ session }: { session: DiscSessionListItem }) {
  const t = useT();
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted text-xs">
          {session.title.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <div className="truncate">
          <span className="font-medium">{session.title}</span>{" "}
          <span className="text-muted-foreground">is</span>{" "}
          <span className="font-medium">{t(sessionStatusMessageKey(session.status))}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {session.participantCount} participants ·{" "}
          {new Date(session.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function LatestReportRow({ item }: { item: DiscHistoryItem }) {
  const disc = topDimension(item.result);
  const score = item.result
    ? Math.round(
        Math.max(
          item.result.D_percent,
          item.result.I_percent,
          item.result.S_percent,
          item.result.C_percent,
        ),
      )
    : null;
  return (
    <Link
      to="/assessments/result"
      search={{ participantId: item.participantId }}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-90"
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted text-xs">
          {item.session.title.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.session.title}</div>
        <div className="text-xs text-muted-foreground">
          {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : "—"}
        </div>
      </div>
      {disc && <DiscBadge type={disc} />}
      <div className="text-sm font-semibold tabular-nums">{score ?? "—"}</div>
    </Link>
  );
}
