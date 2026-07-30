import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  getMyHistory,
  getSessionOverview,
  listSessions,
  filterSessionsForRole,
  topDimension,
  type DiscScoreResult,
  type DiscSessionListItem,
} from "@/lib/api/disc";
import { participantStatusMessageKey, sessionStatusMessageKey, useI18n } from "@/lib/i18n";

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

function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    year: "2-digit",
  });
}

function buildSessionTrend(sessions: DiscSessionListItem[], locale: string) {
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
    month: monthLabel(b.key, locale),
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
  const { locale, t } = useI18n();
  const firstName = displayName.trim().split(/\s+/).at(-1) || "there";

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
  const withResult = useMemo(
    () =>
      history
        .filter((item) => item.result)
        .sort(
          (left, right) =>
            new Date(right.submittedAt ?? 0).getTime() - new Date(left.submittedAt ?? 0).getTime(),
        ),
    [history],
  );
  const activePending = pending[0];
  const latestResult = withResult[0];

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
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t("dashboard.greeting", { name: firstName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.employeeIntro")}</p>
      </header>

      {!isAuthenticated && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("common.signIn")}
          </Link>{" "}
          {t("dashboard.signInEmployee")}
        </Card>
      )}

      {activePending && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <Badge variant="secondary" className="gap-1.5 border">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {t("dashboard.pendingForYou")}
                </Badge>
                <h2 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight">
                  {activePending.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activePending.myParticipant
                    ? t(participantStatusMessageKey(activePending.myParticipant.status))
                    : t("assessments.availableToTake")}{" "}
                  · {t(sessionStatusMessageKey(activePending.status))}
                  {pending.length > 1
                    ? ` · ${t("dashboard.more", { count: pending.length - 1 })}`
                    : ""}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/assessments/questionnaire" search={{ sessionId: activePending.id }}>
                      <PlayCircle className="h-4 w-4" />
                      {activePending.myParticipant
                        ? t("dashboard.continueAssessment")
                        : t("dashboard.takeAssessment")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/assessments">{t("dashboard.viewAll")}</Link>
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
          <Loader2 className="h-4 w-4 animate-spin" /> {t("dashboard.loadingYourData")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.assignedToMe")}
          value={mySessions.length}
          icon={Users}
          accent="primary"
        />
        <StatCard
          label={t("dashboard.pending")}
          value={pending.length}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label={t("dashboard.completed")}
          value={completed.length}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard
          label={t("dashboard.myResults")}
          value={withResult.length}
          icon={FileText}
          accent="primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.myDiscProfile")}</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreBars.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("dashboard.noDiscResult")}
              </p>
            ) : (
              <div className="space-y-4">
                {dominant && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("dashboard.dominantType")}
                    </span>
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
            <CardTitle>{t("dashboard.myStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!latestResult?.result ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("dashboard.noDiscResult")}
              </p>
            ) : (
              <>
                <div>
                  <div className="font-semibold">{latestResult.session.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {latestResult.submittedAt
                      ? new Date(latestResult.submittedAt).toLocaleString(
                          locale === "vi" ? "vi-VN" : "en-US",
                        )
                      : "—"}
                  </div>
                </div>
                {dominant && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("dashboard.dominantType")}
                    </span>
                    <DiscBadge type={dominant} showLabel />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {scoreBars.map((item) => (
                    <div
                      key={item.type}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <span className="font-semibold" style={{ color: item.color }}>
                        {item.type}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{item.value}%</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link
                    to="/assessments/result"
                    search={{ participantId: latestResult.participantId }}
                  >
                    {t("dashboard.viewResult")}
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StaffDashboard({
  isAuthenticated,
  sessions,
  isLoading,
  teamDiscResults,
  overviewsLoading,
}: DashboardData) {
  const { displayName } = useAuth();
  const { locale, t } = useI18n();
  const firstName = displayName.trim().split(/\s+/).at(-1) || "there";

  const openSessions = sessions.filter((s) => s.status === "OPEN");
  const closedSessions = sessions.filter((s) => s.status === "CLOSED");
  const draftSessions = sessions.filter((s) => s.status === "DRAFT");

  const sessionTrend = useMemo(() => buildSessionTrend(sessions, locale), [sessions, locale]);
  const statusPie = useMemo(
    () =>
      buildStatusDistribution(sessions).map((item) => ({
        ...item,
        label:
          item.type === "OPEN"
            ? t("dashboard.active")
            : item.type === "CLOSED"
              ? t("dashboard.closed")
              : t("dashboard.drafts"),
      })),
    [sessions, t],
  );
  const discPie = useMemo(() => buildDiscDistribution(teamDiscResults), [teamDiscResults]);
  const hasDiscData = discPie.some((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("dashboard.overview")}
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            {t("dashboard.greeting", { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.staffIntro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            {t("dashboard.export")}
          </Button>
          <Button size="sm" asChild>
            <Link to="/assessments/new">
              <Plus className="h-4 w-4" />
              {t("dashboard.newAssessment")}
            </Link>
          </Button>
        </div>
      </header>

      {!isAuthenticated && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("common.signIn")}
          </Link>{" "}
          {t("dashboard.signInStaff")}
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("dashboard.loadingStats")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.totalSessions")}
          value={sessions.length}
          icon={Users}
          accent="primary"
        />
        <StatCard
          label={t("dashboard.completed")}
          value={closedSessions.length}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard
          label={t("dashboard.active")}
          value={openSessions.length}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label={t("dashboard.drafts")}
          value={draftSessions.length}
          icon={TrendingUp}
          accent="primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>{t("dashboard.sessionActivity")}</CardTitle>
              <CardDescription>{t("dashboard.sessionActivityDesc")}</CardDescription>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> {t("dashboard.created")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />{" "}
                {t("dashboard.closed")}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("dashboard.noSessionData")}
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
            <CardTitle>{t("dashboard.sessionStatus")}</CardTitle>
            <CardDescription>{t("dashboard.sessionStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("dashboard.noSessions")}
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
            <CardTitle>{t("dashboard.participantsByMonth")}</CardTitle>
            <CardDescription>{t("dashboard.participantsByMonthDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("dashboard.noParticipantData")}
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
            <CardTitle>{t("dashboard.discDistribution")}</CardTitle>
            <CardDescription>{t("dashboard.discDistributionDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("dashboard.loadingDisc")}
              </div>
            ) : !hasDiscData ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("dashboard.noDiscToDisplay")}
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
    </div>
  );
}
