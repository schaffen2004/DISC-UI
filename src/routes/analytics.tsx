import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { DiscBadge } from "@/components/disc-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  filterSessionsForRole,
  getMyHistory,
  getSessionOverview,
  listSessions,
  primaryDiscType,
  type DiscHistoryItem,
  type DiscSessionListItem,
  type DiscSessionOverview,
} from "@/lib/api/disc";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — DigiWork" },
      { name: "description", content: "DISC analytics and insights." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { isStaff } = useAuth();
  return <AppShell>{isStaff ? <StaffAnalytics /> : <MyAnalytics />}</AppShell>;
}

function MyAnalytics() {
  const { isAuthenticated, isLoading: authLoading, displayName } = useAuth();

  const historyQuery = useQuery({
    queryKey: ["disc", "history", "me"],
    queryFn: getMyHistory,
    enabled: isAuthenticated,
  });

  const history = historyQuery.data ?? [];
  const withResult = history.filter((h) => h.result);
  const latest = withResult[0];

  const scores = useMemo(() => {
    const pct = latest?.result?.natural?.percentage ?? latest?.result?.adaptive?.percentage ?? null;
    return {
      D: Math.round(pct?.D ?? 0),
      I: Math.round(pct?.I ?? 0),
      S: Math.round(pct?.S ?? 0),
      C: Math.round(pct?.C ?? 0),
    };
  }, [latest]);

  const radarData = (["D", "I", "S", "C"] as const).map((axis) => ({
    axis,
    value: scores[axis],
  }));

  const pieData = (["D", "I", "S", "C"] as const).map((type) => ({
    type,
    label: type,
    value: scores[type],
    color: `var(--disc-${type.toLowerCase()})`,
  }));

  const trendData = useMemo(() => buildPersonalTrend(withResult), [withResult]);
  const dominant = primaryDiscType(latest?.result?.dominantProfile);

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">My analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal DISC insights for {displayName} — only your data.
        </p>
      </header>

      {!isAuthenticated && !authLoading && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to view your analytics.
        </Card>
      )}

      {(authLoading || (isAuthenticated && historyQuery.isLoading)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your analytics…
        </div>
      )}

      {historyQuery.isError && (
        <Card className="p-4 text-sm text-destructive">
          {(historyQuery.error as Error)?.message || "Failed to load analytics"}
        </Card>
      )}

      {isAuthenticated && !historyQuery.isLoading && !historyQuery.isError && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Assessments</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{history.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">With results</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{withResult.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Latest DISC</div>
              <div className="mt-1">{dominant ? <DiscBadge type={dominant} showLabel /> : "—"}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Latest session</div>
              <div className="mt-1 truncate text-sm font-medium">
                {latest?.session.title ?? "—"}
              </div>
            </Card>
          </div>

          {!latest?.result ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No scored results yet. Complete an assessment to see your personal charts.
              </p>
              <Button asChild variant="outline">
                <Link to="/assessments">Go to assessments</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Your DISC profile</CardTitle>
                  <CardDescription>Natural profile from {latest.session.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer>
                      <RadarChart data={radarData} outerRadius="75%">
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis
                          dataKey="axis"
                          tick={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
                        />
                        <Radar
                          dataKey="value"
                          stroke="var(--primary)"
                          fill="var(--primary)"
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score mix</CardTitle>
                  <CardDescription>Natural percentages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          stroke="var(--background)"
                          strokeWidth={2}
                        >
                          {pieData.map((d) => (
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
                    {pieData.map((d) => (
                      <div key={d.type} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="ml-auto font-semibold tabular-nums">{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {trendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your score trend</CardTitle>
                <CardDescription>Natural DISC scores across completed assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ left: -20 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
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
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="D" stroke="var(--disc-d)" strokeWidth={2} />
                      <Line type="monotone" dataKey="I" stroke="var(--disc-i)" strokeWidth={2} />
                      <Line type="monotone" dataKey="S" stroke="var(--disc-s)" strokeWidth={2} />
                      <Line type="monotone" dataKey="C" stroke="var(--disc-c)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function buildPersonalTrend(items: DiscHistoryItem[]) {
  return [...items].reverse().map((h, idx) => {
    const pct = h.result?.natural?.percentage;
    return {
      label: h.session.title.slice(0, 12) || `#${idx + 1}`,
      D: Math.round(pct?.D ?? 0),
      I: Math.round(pct?.I ?? 0),
      S: Math.round(pct?.S ?? 0),
      C: Math.round(pct?.C ?? 0),
    };
  });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

function buildMonthTrend(sessions: DiscSessionListItem[]) {
  const now = new Date();
  const buckets: Array<{
    key: string;
    created: number;
    closed: number;
    participants: number;
  }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, created: 0, closed: 0, participants: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const s of sessions) {
    const key = monthKey(s.createdAt);
    if (!key) continue;
    const b = map.get(key);
    if (!b) continue;
    b.created += 1;
    b.participants += s.participantCount ?? 0;
    if (s.status === "CLOSED") b.closed += 1;
  }
  return buckets.map((b) => ({
    month: monthLabel(b.key),
    created: b.created,
    closed: b.closed,
    participants: b.participants,
  }));
}

function buildDiscCounts(profiles: Array<string | null | undefined>) {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  for (const profile of profiles) {
    const t = primaryDiscType(profile);
    if (t) counts[t] += 1;
  }
  const total = counts.D + counts.I + counts.S + counts.C;
  return (["D", "I", "S", "C"] as const).map((type) => ({
    type,
    label: type,
    count: counts[type],
    value: total ? Math.round((counts[type] / total) * 100) : 0,
    color: `var(--disc-${type.toLowerCase()})`,
  }));
}

function StaffAnalytics() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const isOperator = (role ?? "").toUpperCase() === "OPERATOR";

  const sessionsQuery = useQuery({
    queryKey: ["disc", "sessions"],
    queryFn: listSessions,
    enabled: isAuthenticated,
  });

  const sessions = useMemo(
    () => filterSessionsForRole(sessionsQuery.data ?? [], role),
    [sessionsQuery.data, role],
  );

  const managedSessions = useMemo(() => sessions.filter((s) => s.isManager), [sessions]);

  const overviewIds = useMemo(
    () =>
      managedSessions
        .filter((s) => s.status === "OPEN" || s.status === "CLOSED")
        .slice(0, 20)
        .map((s) => s.id),
    [managedSessions],
  );

  const overviewQueries = useQueries({
    queries: overviewIds.map((id) => ({
      queryKey: ["disc", "session", id, "overview"],
      queryFn: () => getSessionOverview(id),
      enabled: isAuthenticated && Boolean(id),
    })),
  });

  const overviews = useMemo(
    () => overviewQueries.map((q) => q.data).filter(Boolean) as DiscSessionOverview[],
    [overviewQueries],
  );

  const overviewsLoading = overviewQueries.some((q) => q.isLoading);
  const isLoading = sessionsQuery.isLoading || overviewsLoading;

  const openCount = sessions.filter((s) => s.status === "OPEN").length;
  const closedCount = sessions.filter((s) => s.status === "CLOSED").length;
  const draftCount = sessions.filter((s) => s.status === "DRAFT").length;
  const totalParticipants = sessions.reduce((sum, s) => sum + (s.participantCount ?? 0), 0);

  const allParticipants = useMemo(() => overviews.flatMap((o) => o.participants), [overviews]);
  const withResult = allParticipants.filter((p) => p.result);
  const doneCount = allParticipants.filter(
    (p) => p.status === "SUBMITTED" || p.status === "VERIFIED",
  ).length;
  const completionRate = allParticipants.length
    ? Math.round((doneCount / allParticipants.length) * 100)
    : 0;

  const discPie = useMemo(
    () => buildDiscCounts(withResult.map((p) => p.result?.dominantProfile)),
    [withResult],
  );
  const hasDiscData = discPie.some((d) => d.count > 0);

  const statusPie = useMemo(() => {
    const items = [
      { type: "OPEN", label: "Active", value: openCount, color: "var(--primary)" },
      { type: "CLOSED", label: "Closed", value: closedCount, color: "var(--disc-s)" },
      { type: "DRAFT", label: "Draft", value: draftCount, color: "var(--muted-foreground)" },
    ];
    return items.filter((d) => d.value > 0);
  }, [openCount, closedCount, draftCount]);

  const participantStatusPie = useMemo(() => {
    const counts = { INVITED: 0, IN_PROGRESS: 0, SUBMITTED: 0, VERIFIED: 0 };
    for (const p of allParticipants) counts[p.status] += 1;
    return [
      {
        type: "INVITED",
        label: "Invited",
        value: counts.INVITED,
        color: "var(--muted-foreground)",
      },
      {
        type: "IN_PROGRESS",
        label: "In progress",
        value: counts.IN_PROGRESS,
        color: "var(--warning)",
      },
      { type: "SUBMITTED", label: "Submitted", value: counts.SUBMITTED, color: "var(--primary)" },
      { type: "VERIFIED", label: "Verified", value: counts.VERIFIED, color: "var(--disc-s)" },
    ].filter((d) => d.value > 0);
  }, [allParticipants]);

  const monthTrend = useMemo(() => buildMonthTrend(sessions), [sessions]);

  const avgRadar = useMemo(() => {
    const sums = { D: 0, I: 0, S: 0, C: 0 };
    let n = 0;
    for (const p of withResult) {
      const pct = p.result?.natural?.percentage ?? p.result?.adaptive?.percentage;
      if (!pct) continue;
      sums.D += pct.D ?? 0;
      sums.I += pct.I ?? 0;
      sums.S += pct.S ?? 0;
      sums.C += pct.C ?? 0;
      n += 1;
    }
    return (["D", "I", "S", "C"] as const).map((axis) => ({
      axis,
      value: n ? Math.round(sums[axis] / n) : 0,
    }));
  }, [withResult]);

  const sessionDiscBars = useMemo(() => {
    return overviews
      .map((o) => {
        const counts = { D: 0, I: 0, S: 0, C: 0 };
        for (const p of o.participants) {
          const t = primaryDiscType(p.result?.dominantProfile);
          if (t) counts[t] += 1;
        }
        const total = counts.D + counts.I + counts.S + counts.C;
        if (!total) return null;
        return {
          session: o.title.length > 18 ? `${o.title.slice(0, 16)}…` : o.title,
          ...counts,
          total,
        };
      })
      .filter(Boolean)
      .slice(0, 8) as Array<{
      session: string;
      D: number;
      I: number;
      S: number;
      C: number;
      total: number;
    }>;
  }, [overviews]);

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOperator
            ? "Overview of sessions you created or joined."
            : "Organization-wide assessment overview from live data."}
        </p>
      </header>

      {!isAuthenticated && !authLoading && (
        <Card className="p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to load analytics.
        </Card>
      )}

      {(authLoading || (isAuthenticated && isLoading)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading live analytics…
        </div>
      )}

      {sessionsQuery.isError && (
        <Card className="p-4 text-sm text-destructive">
          {(sessionsQuery.error as Error)?.message || "Failed to load sessions"}
        </Card>
      )}

      {isAuthenticated && !isLoading && !sessionsQuery.isError && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Sessions</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{sessions.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{openCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Completed</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{closedCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Assignees</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{totalParticipants}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Scored results</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{withResult.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Completion</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{completionRate}%</div>
            </Card>
          </div>

          {sessions.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Chưa có session để phân tích. Tạo assessment để xem tổng quan.
              </p>
              <Button asChild variant="outline">
                <Link to="/assessments/new">Create assessment</Link>
              </Button>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Session activity</CardTitle>
                    <CardDescription>
                      Created vs completed sessions in the last 6 months
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer>
                        <LineChart data={monthTrend} margin={{ left: -20 }}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                            vertical={false}
                          />
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
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line
                            type="monotone"
                            dataKey="created"
                            name="Created"
                            stroke="var(--primary)"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="closed"
                            name="Closed"
                            stroke="var(--disc-s)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Session status</CardTitle>
                    <CardDescription>Live breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statusPie.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">No data</p>
                    ) : (
                      <>
                        <div className="h-[200px]">
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={statusPie}
                                dataKey="value"
                                nameKey="label"
                                innerRadius={50}
                                outerRadius={80}
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
                        <div className="mt-2 space-y-1.5 text-xs">
                          {statusPie.map((d) => (
                            <div key={d.type} className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-sm"
                                style={{ background: d.color }}
                              />
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
                    <CardTitle>DISC by session</CardTitle>
                    <CardDescription>
                      Dominant profiles from managed sessions with scored results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sessionDiscBars.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        Chưa có kết quả DISC từ các session bạn quản lý.
                      </p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer>
                          <BarChart data={sessionDiscBars} margin={{ left: -10 }}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="session"
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
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="D" stackId="a" fill="var(--disc-d)" />
                            <Bar dataKey="I" stackId="a" fill="var(--disc-i)" />
                            <Bar dataKey="S" stackId="a" fill="var(--disc-s)" />
                            <Bar
                              dataKey="C"
                              stackId="a"
                              fill="var(--disc-c)"
                              radius={[6, 6, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Overall DISC</CardTitle>
                    <CardDescription>Dominant type mix</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!hasDiscData ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        Chưa có kết quả để tổng hợp.
                      </p>
                    ) : (
                      <>
                        <div className="h-[200px]">
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={discPie.filter((d) => d.count > 0)}
                                dataKey="count"
                                nameKey="label"
                                innerRadius={50}
                                outerRadius={80}
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
                              <span
                                className="h-2.5 w-2.5 rounded-sm"
                                style={{ background: d.color }}
                              />
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

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Average DISC profile</CardTitle>
                    <CardDescription>
                      Mean natural scores across {withResult.length} scored participant
                      {withResult.length === 1 ? "" : "s"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {withResult.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        Chưa đủ dữ liệu để vẽ radar.
                      </p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer>
                          <RadarChart data={avgRadar} outerRadius="75%">
                            <PolarGrid stroke="var(--border)" />
                            <PolarAngleAxis
                              dataKey="axis"
                              tick={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
                            />
                            <Radar
                              dataKey="value"
                              stroke="var(--primary)"
                              fill="var(--primary)"
                              fillOpacity={0.25}
                              strokeWidth={2}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Participant progress</CardTitle>
                    <CardDescription>
                      Status mix from {allParticipants.length} tracked participant
                      {allParticipants.length === 1 ? "" : "s"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {participantStatusPie.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        Chưa có participant trong các session quản lý.
                      </p>
                    ) : (
                      <>
                        <div className="h-[220px]">
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={participantStatusPie}
                                dataKey="value"
                                nameKey="label"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={3}
                                stroke="var(--background)"
                                strokeWidth={2}
                              >
                                {participantStatusPie.map((d) => (
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
                          {participantStatusPie.map((d) => (
                            <div key={d.type} className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-sm"
                                style={{ background: d.color }}
                              />
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Managed sessions</CardTitle>
                    <CardDescription>Quick overview of sessions you own</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/assessments">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {managedSessions.slice(0, 6).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.participantCount} participants · {s.status}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/reports/$id" params={{ id: s.id }}>
                          Report
                        </Link>
                      </Button>
                    </div>
                  ))}
                  {managedSessions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Bạn chưa tạo session nào để quản lý.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
