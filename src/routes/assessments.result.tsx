import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, ArrowRight, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { DiscBadge } from "@/components/disc-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { discFullName, discProfile } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import { downloadResultPdf, getResult, primaryDiscType } from "@/lib/api/disc";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  participantId: z.string().uuid().optional(),
});

function isDiscResultNotFound(error: unknown) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : "";
  return message.includes("DISC_RESULT_NOT_FOUND");
}

export const Route = createFileRoute("/assessments/result")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Assessment Result — DigiWork" },
      { name: "description", content: "Your DISC assessment result with detailed analysis." },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const { participantId } = Route.useSearch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useT();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["disc", "result", participantId],
    queryFn: () => getResult(participantId!),
    enabled: Boolean(isAuthenticated && participantId),
  });

  const onDownloadPdf = async () => {
    if (!participantId) return;
    setPdfError(null);
    setPdfLoading(true);
    try {
      const title = data?.session.title?.replace(/[^\w-]+/g, "-").slice(0, 40) || "result";
      await downloadResultPdf(participantId, `disc-report-${title}.pdf`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF download failed";
      setPdfError(
        message.includes("DISC_RESULT_NOT_FOUND")
          ? "Không có kết quả PDF — bạn chưa hoàn thành bài đánh giá."
          : message,
      );
    } finally {
      setPdfLoading(false);
    }
  };

  if (!participantId) {
    return (
      <AppShell>
        <EmptyState
          title="Missing participant"
          body="Open a result with a participantId, or pick one from Reports."
          action={
            <Button asChild>
              <Link to="/reports">Go to reports</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  if (!isAuthenticated && !authLoading) {
    return (
      <AppShell>
        <EmptyState
          title="Sign in required"
          body="Sign in to view DISC results."
          action={
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  if (authLoading || isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading result…
        </div>
      </AppShell>
    );
  }

  if (isError) {
    if (isDiscResultNotFound(error)) {
      return (
        <AppShell>
          <EmptyState
            title="Không tham gia bài đánh giá"
            body="Bạn không thực hiện bài đánh giá này nên không có kết quả để hiển thị."
            action={
              <Button asChild>
                <Link to="/assessments">Back to assessments</Link>
              </Button>
            }
          />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <EmptyState
          title="Could not load result"
          body={error instanceof Error ? error.message : "Something went wrong"}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
              <Button asChild>
                <Link to="/reports">Reports</Link>
              </Button>
            </div>
          }
        />
      </AppShell>
    );
  }

  const result = data?.result;
  if (!result) {
    const didNotParticipate = data?.status === "INVITED" || data?.status === "IN_PROGRESS";
    return (
      <AppShell>
        <EmptyState
          title={didNotParticipate ? "Không tham gia bài đánh giá" : "Result not ready"}
          body={
            didNotParticipate
              ? "Bạn không thực hiện bài đánh giá này nên không có kết quả để hiển thị."
              : `Status: ${data?.status ?? "unknown"}. A scored result is not available yet.`
          }
          action={
            <Button asChild>
              <Link to="/assessments">Back to assessments</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const scores = result.natural?.percentage ??
    result.adaptive?.percentage ?? {
      D: 0,
      I: 0,
      S: 0,
      C: 0,
    };
  const dominant = primaryDiscType(result.dominantProfile) ?? "D";
  const radar = (["D", "I", "S", "C"] as const).map((axis) => ({
    axis,
    value: scores[axis] ?? 0,
  }));
  const completedAt = result.calculatedAt
    ? new Date(result.calculatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t("result.title")}
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
              {data?.session.title ?? t("result.yourProfile")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("result.completed", {
                date: completedAt,
                profile: result.dominantProfile,
                algo: result.algorithmVersion,
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t("common.print")}
            </Button>
            <Button size="sm" onClick={onDownloadPdf} disabled={pdfLoading}>
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("common.downloadPdf")}
            </Button>
          </div>
        </header>

        {pdfError && (
          <Card className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {pdfError}
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>DISC Radar</CardTitle>
              <CardDescription>
                Natural style distribution across the four dimensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[360px]">
                <ResponsiveContainer>
                  <RadarChart data={radar} outerRadius="80%">
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis
                      dataKey="axis"
                      tick={{ fill: "var(--foreground)", fontSize: 14, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
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
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Dominant type</span>
                <DiscBadge type={dominant} showLabel />
              </div>
              <CardTitle className="text-2xl">{result.dominantProfile}</CardTitle>
              <CardDescription>{discFullName[dominant]} · Natural style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(scores) as ["D" | "I" | "S" | "C", number][]).map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">
                      <span
                        className="mr-2 inline-grid h-4 w-4 place-items-center rounded-sm text-[10px] font-bold text-white"
                        style={{ background: `var(--disc-${k.toLowerCase()})` }}
                      >
                        {k}
                      </span>
                      {discFullName[k]}
                    </span>
                    <span className="tabular-nums font-semibold">{v}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${v}%`,
                        background: `var(--disc-${k.toLowerCase()})`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <Separator className="my-3" />
              <Button asChild variant="outline" className="w-full">
                <Link to="/reports/$id" params={{ id: data.session.id }}>
                  View session report <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { label: t("disc.level.1"), level: result.adaptive },
              { label: t("disc.level.2"), level: result.natural },
              { label: t("disc.level.3"), level: result.pressure },
              { label: t("disc.level.4"), level: result.motivatorFear },
              ...(result.managerValidation
                ? [{ label: t("disc.level.5"), level: result.managerValidation }]
                : []),
            ] as const
          ).map(({ label, level }) => {
            const pct = level?.percentage;
            const dominantLetters = new Set(
              (level?.dominantProfile ?? "")
                .toUpperCase()
                .split("")
                .filter((ch): ch is "D" | "I" | "S" | "C" =>
                  ch === "D" || ch === "I" || ch === "S" || ch === "C",
                ),
            );
            // Fallback: highlight max percentage group(s) when profile is missing
            if (dominantLetters.size === 0 && pct) {
              const max = Math.max(pct.D, pct.I, pct.S, pct.C);
              for (const k of ["D", "I", "S", "C"] as const) {
                if (pct[k] === max) dominantLetters.add(k);
              }
            }
            const primary =
              ([...dominantLetters][0] as "D" | "I" | "S" | "C" | undefined) ?? null;

            return (
              <Card
                key={label}
                className={cn(
                  "overflow-hidden",
                  primary && "border-l-4",
                )}
                style={
                  primary
                    ? { borderLeftColor: `var(--disc-${primary.toLowerCase()})` }
                    : undefined
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {primary ? <DiscBadge type={primary} /> : null}
                    <span className="font-semibold text-foreground">
                      {level?.dominantProfile ?? "—"}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {(["D", "I", "S", "C"] as const).map((k) => {
                    const isDominant = dominantLetters.has(k);
                    const value = pct?.[k] ?? 0;
                    return (
                      <Badge
                        key={k}
                        variant="outline"
                        className={cn(
                          "tabular-nums border transition-colors",
                          isDominant
                            ? "border-transparent text-white shadow-sm"
                            : "text-muted-foreground opacity-70",
                        )}
                        style={
                          isDominant
                            ? { background: `var(--disc-${k.toLowerCase()})` }
                            : undefined
                        }
                      >
                        {k} {value}%
                      </Badge>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Narrative copy still from mock until content API exists */}
        <Card>
          <CardHeader>
            <CardTitle>Behavior summary</CardTitle>
            <CardDescription>Reference narrative for {discFullName[dominant]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
              {discProfile.summary}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
