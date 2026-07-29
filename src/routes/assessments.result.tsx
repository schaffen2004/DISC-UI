import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, Loader2 } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import {
  downloadResultPdf,
  getResult,
  topDimension,
  DISC_DIMENSIONS,
  discDimensionName,
  type DiscScoreResult,
  type DiscConsistencyLevel,
} from "@/lib/api/disc";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  participantId: z.string().uuid().optional(),
});

function isDiscResultNotFound(error: unknown) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : "";
  return message.includes("DISC_RESULT_NOT_FOUND");
}

const consistencyStyle: Record<
  DiscConsistencyLevel,
  { label: string; color: string; description: string }
> = {
  High: { label: "Cao", color: "text-[var(--success)]", description: "Câu trả lời rất nhất quán" },
  Acceptable: {
    label: "Chấp nhận",
    color: "text-primary",
    description: "Câu trả lời khá nhất quán",
  },
  Unstable: {
    label: "Không ổn định",
    color: "text-[var(--warning)]",
    description: "Có sự khác biệt đáng kể giữa các câu trả lời",
  },
  Low: { label: "Thấp", color: "text-destructive", description: "Câu trả lời thiếu nhất quán" },
};

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

  const result = data?.result as DiscScoreResult | null | undefined;
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

  const radar = DISC_DIMENSIONS.map((axis) => ({
    axis,
    value: result[`${axis}_percent`] ?? 0,
  }));
  const top = topDimension(result);
  const cLevel = consistencyStyle[result.consistency_level] ?? consistencyStyle.High;

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
              <CardDescription>Phân bố phần trăm theo bốn chiều D·I·S·C</CardDescription>
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
              <CardTitle className="text-lg">Điểm theo chiều</CardTitle>
              <CardDescription>Phần trăm và điểm thô (12–60)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DISC_DIMENSIONS.map((k) => {
                const pctVal = result[`${k}_percent`] ?? 0;
                const rawVal = result[k] ?? 0;
                const isTop = k === top;
                return (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">
                        <span
                          className={cn(
                            "mr-2 inline-grid h-4 w-4 place-items-center rounded-sm text-[10px] font-bold text-white",
                            isTop && "ring-2 ring-offset-1",
                          )}
                          style={{ background: `var(--disc-${k.toLowerCase()})` }}
                        >
                          {k}
                        </span>
                        {discDimensionName[k]}
                      </span>
                      <span className="tabular-nums font-semibold">
                        {pctVal}%{" "}
                        <span className="text-muted-foreground font-normal">({rawVal}/60)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pctVal}%`,
                          background: `var(--disc-${k.toLowerCase()})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <Separator className="my-3" />
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Độ nhất quán</span>
                  <Badge variant="outline" className={cn("font-semibold", cLevel.color)}>
                    {result.consistency}% — {cLevel.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{cLevel.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Phương pháp tính điểm</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
              Điểm mỗi nhóm D/I/S/C được tính từ 12 câu chính trên thang Likert 1–5 (phạm vi 12–60).
              Phần trăm được chuẩn hóa: ((điểm thô − 12) / 48) × 100. 12 câu đảo chỉ dùng để đo độ
              nhất quán, không cộng vào điểm nhóm. Báo cáo không kết luận nhóm DISC ưu thế.
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
