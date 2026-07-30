import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import {
  downloadResultPdf,
  getAnalysisStatus,
  getResult,
  isAnalysisInProgress,
  isAnalysisRetryable,
  isConsistencyRetakeAllowed,
  retakeAssessment,
  retryAnalysis,
  topDimension,
  DISC_DIMENSIONS,
  discDimensionName,
  type DiscAnalysis,
  type DiscAnalysisStep,
  type DiscAnalysisStepStatus,
  type DiscHistoryItem,
  type DiscLlmReport,
  type DiscRetakeMode,
  type DiscScoreResult,
  type DiscParticipantStatus,
} from "@/lib/api/disc";
import { participantStatusMessageKey, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  participantId: z.string().uuid().optional(),
});

function isDiscResultNotFound(error: unknown) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : "";
  return message.includes("DISC_RESULT_NOT_FOUND");
}

const STEP_I18N_KEY: Record<DiscAnalysisStep, string> = {
  CONSISTENCY: "analysis.step.CONSISTENCY",
  CONTRADICTION_CHECK: "analysis.step.CONTRADICTION_CHECK",
  GROUP_SCORES: "analysis.step.GROUP_SCORES",
  PROFILE_ANALYSIS: "analysis.step.PROFILE_ANALYSIS",
  PDF_EXPORT: "analysis.step.PDF_EXPORT",
};

const STEP_STATUS_I18N_KEY: Record<DiscAnalysisStepStatus, string> = {
  PENDING: "analysis.stepStatus.PENDING",
  RUNNING: "analysis.stepStatus.RUNNING",
  DONE: "analysis.stepStatus.DONE",
  SKIPPED: "analysis.stepStatus.SKIPPED",
  FAILED: "analysis.stepStatus.FAILED",
  BLOCKED: "analysis.stepStatus.BLOCKED",
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["disc", "result", participantId],
    queryFn: () => getResult(participantId!),
    enabled: Boolean(isAuthenticated && participantId),
  });

  const analysisQuery = useQuery({
    queryKey: ["disc", "analysis", participantId],
    queryFn: () => getAnalysisStatus(participantId!),
    enabled: Boolean(
      isAuthenticated &&
      participantId &&
      (data?.status === "SUBMITTED" || data?.status === "VERIFIED"),
    ),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return isAnalysisInProgress(status) ? 1500 : false;
    },
  });

  const analysis = analysisQuery.data ?? data?.analysis ?? null;
  const analysisStatus = analysis?.status;
  const analyzing = isAnalysisInProgress(analysisStatus);
  const analysisFailed = analysisStatus === "FAILED" || analysisStatus === "BLOCKED";
  const canRetryAnalysis = isAnalysisRetryable(analysisStatus);
  const canRetake = isConsistencyRetakeAllowed(analysis);

  const [retryError, setRetryError] = useState<string | null>(null);

  const retryMutation = useMutation({
    mutationFn: () => retryAnalysis(participantId!),
    onSuccess: async (res) => {
      setRetryError(null);
      queryClient.setQueryData(
        ["disc", "analysis", participantId],
        (prev: DiscAnalysis | null | undefined) => {
          if (!prev) {
            return {
              status: res.status,
              currentStep: res.resumedFrom,
              progress: { done: 0, total: 5, percent: 0 },
              steps: [],
              error: null,
              contradictionReport: null,
              pdfReady: false,
              startedAt: null,
              finishedAt: null,
              scoreResult: null,
              llmReport: null,
            } satisfies DiscAnalysis;
          }
          const failedIdx = prev.steps.findIndex((s) => s.status === "FAILED");
          const isPartialResume = failedIdx >= 0 && prev.steps[failedIdx]?.step === res.resumedFrom;
          const steps = prev.steps.map((step, idx) => {
            if (isPartialResume && idx < failedIdx) return step;
            return {
              ...step,
              status: "PENDING" as const,
              message: undefined,
              startedAt: undefined,
              finishedAt: undefined,
            };
          });
          const done = steps.filter((s) =>
            ["DONE", "SKIPPED", "BLOCKED"].includes(s.status),
          ).length;
          return {
            ...prev,
            status: res.status,
            currentStep: res.resumedFrom,
            error: null,
            finishedAt: null,
            pdfReady: false,
            scoreResult: isPartialResume ? prev.scoreResult : null,
            llmReport: isPartialResume ? prev.llmReport : null,
            steps,
            progress: {
              done,
              total: steps.length || prev.progress.total,
              percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
            },
          };
        },
      );
      if (participantId) {
        queryClient.setQueryData(
          ["disc", "result", participantId],
          (prev: DiscHistoryItem | null | undefined) => {
            if (!prev) return prev;
            return { ...prev, result: null, analysis: undefined };
          },
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["disc", "analysis", participantId] }),
        queryClient.invalidateQueries({ queryKey: ["disc", "result", participantId] }),
      ]);
    },
    onError: (err) => {
      const message =
        err instanceof ApiError || err instanceof Error ? err.message : t("analysis.retryFailed");
      if (message.includes("DISC_ANALYSIS_RETRY_ONLY_FOR_CONNECTION_ERROR")) {
        setRetryError(t("analysis.retryOnlyConnection"));
      } else if (message.includes("DISC_ANALYSIS_RETRY_REQUIRES_FAILED")) {
        setRetryError(t("analysis.retryRequiresFailed"));
      } else if (message.includes("DISC_ANALYSIS_RETRY_NOT_ALLOWED")) {
        setRetryError(t("analysis.retryNotAllowed"));
      } else if (message.includes("DISC_ANALYSIS_ALREADY_RUNNING")) {
        setRetryError(t("analysis.retryAlreadyRunning"));
      } else if (message.includes("DISC_ANALYSIS_FAILED_STEP_NOT_FOUND")) {
        setRetryError(t("analysis.retryStepNotFound"));
      } else {
        setRetryError(message);
      }
    },
  });

  const retakeMutation = useMutation({
    mutationFn: (mode: DiscRetakeMode) => retakeAssessment(participantId!, mode),
    onSuccess: async (res) => {
      setRetryError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["disc", "history", "me"] }),
        queryClient.invalidateQueries({ queryKey: ["disc", "assessment", res.sessionId] }),
        queryClient.removeQueries({ queryKey: ["disc", "result", participantId] }),
        queryClient.removeQueries({ queryKey: ["disc", "analysis", participantId] }),
      ]);
      navigate({
        to: "/assessments/questionnaire",
        search: { sessionId: res.sessionId },
      });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError || err instanceof Error ? err.message : t("analysis.retakeFailed");
      if (message.includes("DISC_RETAKE_REQUIRES_BLOCKED")) {
        setRetryError(t("analysis.retakeRequiresBlocked"));
      } else if (message.includes("DISC_RETAKE_REQUIRES_LOW_CONSISTENCY")) {
        setRetryError(t("analysis.retakeRequiresLowConsistency"));
      } else if (message.includes("DISC_RETAKE_SELF_ONLY")) {
        setRetryError(t("analysis.retakeSelfOnly"));
      } else if (message.includes("DISC_SESSION_NOT_OPEN")) {
        setRetryError(t("analysis.retakeSessionClosed"));
      } else {
        setRetryError(message);
      }
    },
  });

  useEffect(() => {
    setRetryError(null);
  }, [analysisStatus, analysis?.error]);

  useEffect(() => {
    if (!participantId || !analysisStatus) return;
    if (analysisStatus === "COMPLETED" || analysis?.scoreResult) {
      void queryClient.invalidateQueries({ queryKey: ["disc", "result", participantId] });
    }
  }, [analysisStatus, analysis?.scoreResult, participantId, queryClient]);

  const onDownloadPdf = async () => {
    if (!participantId) return;
    if (!analysis?.pdfReady && analysisStatus !== "COMPLETED") {
      setPdfError(t("analysis.pdfNotReady"));
      return;
    }
    setPdfError(null);
    setPdfLoading(true);
    try {
      const title = data?.session.title?.replace(/[^\w-]+/g, "-").slice(0, 40) || "result";
      await downloadResultPdf(participantId, `disc-report-${title}.pdf`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("analysis.pdfFailed");
      setPdfError(
        message.includes("DISC_RESULT_NOT_FOUND")
          ? t("analysis.pdfNotFound")
          : message.includes("DISC_ANALYSIS_NOT_READY")
            ? t("analysis.pdfNotReady")
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
          title={t("result.missingParticipant")}
          body={t("result.missingParticipantBody")}
          action={
            <Button asChild>
              <Link to="/reports">{t("result.goReports")}</Link>
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
          title={t("result.signInRequired")}
          body={t("result.signInBody")}
          action={
            <Button asChild>
              <Link to="/login">{t("common.signIn")}</Link>
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
          {t("result.loading")}
        </div>
      </AppShell>
    );
  }

  if (isError) {
    if (isDiscResultNotFound(error)) {
      return (
        <AppShell>
          <EmptyState
            title={t("result.notParticipated")}
            body={t("result.notParticipatedBody")}
            action={
              <Button asChild>
                <Link to="/assessments">{t("questionnaire.backToAssessments")}</Link>
              </Button>
            }
          />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <EmptyState
          title={t("result.loadFailed")}
          body={error instanceof Error ? error.message : t("questionnaire.somethingWrong")}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                {t("common.retry")}
              </Button>
              <Button asChild>
                <Link to="/reports">{t("result.goReports")}</Link>
              </Button>
            </div>
          }
        />
      </AppShell>
    );
  }

  const didNotParticipate = data?.status === "INVITED" || data?.status === "IN_PROGRESS";
  if (didNotParticipate) {
    return (
      <AppShell>
        <EmptyState
          title={t("result.notParticipated")}
          body={t("result.notParticipatedBody")}
          action={
            <Button asChild>
              <Link to="/assessments">{t("questionnaire.backToAssessments")}</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const result =
    (data?.result as DiscScoreResult | null | undefined) ??
    (analysis?.scoreResult as DiscScoreResult | null | undefined) ??
    null;

  const hasFullScores =
    Boolean(result) &&
    typeof result?.D_percent === "number" &&
    typeof result?.I_percent === "number" &&
    typeof result?.S_percent === "number" &&
    typeof result?.C_percent === "number";

  const analysisLoading =
    !hasFullScores &&
    !analysis &&
    !analysisFailed &&
    !analysisQuery.isError &&
    (analysisQuery.isLoading ||
      analysisQuery.isFetching ||
      data?.status === "SUBMITTED" ||
      data?.status === "VERIFIED");

  const showTracing = Boolean(analysis) && (analyzing || analysisFailed || !hasFullScores);
  const showScores = hasFullScores && analysisStatus !== "FAILED";

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {data?.session.title ?? t("result.reportTitle")}
            </h1>
          </div>
          {showScores && (
            <div className="flex flex-wrap gap-2">
              {canRetryAnalysis && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending || analyzing}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t("analysis.refreshStatus")}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                {t("common.print")}
              </Button>
              <Button
                size="sm"
                onClick={onDownloadPdf}
                disabled={pdfLoading || (!analysis?.pdfReady && analysisStatus !== "COMPLETED")}
              >
                {pdfLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("common.downloadPdf")}
              </Button>
            </div>
          )}
        </header>

        {pdfError && (
          <Card className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {pdfError}
          </Card>
        )}

        {retryError && !showTracing && (
          <Card className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {retryError}
          </Card>
        )}

        {analysisLoading && (
          <Card className="border-primary/30">
            <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              {t("analysis.inProgressBody")}
            </CardContent>
          </Card>
        )}

        {showTracing && analysis && (
          <AnalysisTracingCard
            analysis={analysis}
            analyzing={analyzing}
            failed={analysisFailed}
            canRetry={canRetryAnalysis}
            canRetake={canRetake}
            retryPending={retryMutation.isPending}
            retakePending={retakeMutation.isPending}
            retryError={retryError}
            onRetry={() => retryMutation.mutate()}
            onEditAnswers={() => {
              if (!window.confirm(t("analysis.editConfirm"))) return;
              retakeMutation.mutate("edit");
            }}
            onStartNew={() => {
              if (!window.confirm(t("analysis.newConfirm"))) return;
              retakeMutation.mutate("new");
            }}
          />
        )}

        {analysisQuery.isError && !analysis && !hasFullScores && (
          <EmptyState
            title={t("analysis.loadFailed")}
            body={
              analysisQuery.error instanceof Error
                ? analysisQuery.error.message
                : t("questionnaire.somethingWrong")
            }
            action={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void analysisQuery.refetch();
                    void refetch();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("common.retry")}
                </Button>
                <Button asChild>
                  <Link to="/assessments">{t("questionnaire.backToAssessments")}</Link>
                </Button>
              </div>
            }
          />
        )}

        {!hasFullScores && !analysisLoading && !showTracing && (
          <EmptyState
            title={t("analysis.notReadyTitle")}
            body={t("analysis.notReadyBody", { status: data?.status ?? "unknown" })}
            action={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void refetch();
                    void analysisQuery.refetch();
                  }}
                >
                  {t("common.retry")}
                </Button>
                <Button asChild>
                  <Link to="/assessments">{t("questionnaire.backToAssessments")}</Link>
                </Button>
              </div>
            }
          />
        )}

        {showScores && result && (
          <ScoreResultView result={result} meta={data} llmReport={analysis?.llmReport ?? null} />
        )}
      </div>
    </AppShell>
  );
}

function formatDurationMs(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function durationBetween(start?: string | null, end?: string | null, nowMs = Date.now()) {
  if (!start) return null;
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return null;
  const endMs = end ? Date.parse(end) : nowMs;
  if (!Number.isFinite(endMs)) return null;
  return Math.max(0, endMs - startMs);
}

function AnalysisTracingCard({
  analysis,
  analyzing,
  failed,
  canRetry,
  canRetake,
  retryPending,
  retakePending,
  retryError,
  onRetry,
  onEditAnswers,
  onStartNew,
}: {
  analysis: DiscAnalysis;
  analyzing: boolean;
  failed: boolean;
  canRetry?: boolean;
  canRetake?: boolean;
  retryPending?: boolean;
  retakePending?: boolean;
  retryError?: string | null;
  onRetry?: () => void;
  onEditAnswers?: () => void;
  onStartNew?: () => void;
}) {
  const t = useT();
  const percent = analysis.progress?.percent ?? 0;
  const statusLabel = t(`analysis.status.${analysis.status}` as Parameters<typeof t>[0]);
  const showRetryActions = failed && analysis.status === "FAILED";
  const busy = Boolean(retryPending || retakePending || analyzing);
  const consistencyValue =
    typeof analysis.scoreResult?.consistency === "number" ? analysis.scoreResult.consistency : null;
  const [nowMs, setNowMs] = useState(() => Date.now());

  const needsLiveClock =
    analyzing ||
    analysis.steps.some((step) => step.status === "RUNNING" && Boolean(step.startedAt));

  useEffect(() => {
    if (!needsLiveClock) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [needsLiveClock, analysis.status, analysis.currentStep]);

  const sortedSteps = useMemo(
    () => [...analysis.steps].sort((a, b) => a.order - b.order),
    [analysis.steps],
  );

  const totalDurationLabel = formatDurationMs(
    durationBetween(analysis.startedAt, analysis.finishedAt, nowMs),
  );

  return (
    <Card
      className={cn(
        failed && "border-destructive/30",
        analyzing && "border-primary/30",
        analysis.status === "COMPLETED" && "border-[var(--success)]/30",
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : failed ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
              )}
              {analyzing
                ? t("analysis.inProgressTitle")
                : failed
                  ? t("analysis.failedTitle")
                  : t("analysis.completedTitle")}
            </CardTitle>
            <CardDescription className="mt-1">
              {analyzing
                ? t("analysis.inProgressBody")
                : failed
                  ? analysis.error || t("analysis.failedBody")
                  : t("analysis.completedBody")}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant="outline"
              className={cn(
                analyzing && "border-primary/40 text-primary",
                failed && "border-destructive/40 text-destructive",
                analysis.status === "COMPLETED" &&
                  "border-[var(--success)]/40 text-[var(--success)]",
              )}
            >
              {statusLabel}
            </Badge>
            {totalDurationLabel && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("analysis.totalDuration", { duration: totalDurationLabel })}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {t("analysis.progress", {
                done: analysis.progress?.done ?? 0,
                total: analysis.progress?.total ?? analysis.steps.length,
              })}
            </span>
            <div className="flex items-center gap-3">
              {totalDurationLabel && (
                <span className="tabular-nums">
                  {t("analysis.totalDuration", { duration: totalDurationLabel })}
                </span>
              )}
              <span className="font-medium tabular-nums text-foreground">{percent}%</span>
            </div>
          </div>
          <Progress value={percent} />
        </div>

        <ol className="space-y-3">
          {sortedSteps.map((step) => {
            const stepDurationMs =
              step.status === "RUNNING"
                ? durationBetween(step.startedAt, null, nowMs)
                : step.finishedAt
                  ? durationBetween(step.startedAt, step.finishedAt, nowMs)
                  : null;
            const stepDurationLabel = formatDurationMs(stepDurationMs);
            return (
              <li
                key={step.step}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3",
                  step.status === "RUNNING" && "border-primary/40 bg-primary/5",
                  step.status === "DONE" && "border-[var(--success)]/25 bg-[var(--success)]/5",
                  (step.status === "FAILED" || step.status === "BLOCKED") &&
                    "border-destructive/30 bg-destructive/5",
                )}
              >
                <StepStatusIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {t(STEP_I18N_KEY[step.step] as Parameters<typeof t>[0])}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {stepDurationLabel && (
                        <span className="tabular-nums font-medium text-foreground">
                          {stepDurationLabel}
                        </span>
                      )}
                      <span>{t(STEP_STATUS_I18N_KEY[step.status] as Parameters<typeof t>[0])}</span>
                    </div>
                  </div>
                  {step.message && (
                    <p className="mt-1 text-xs text-muted-foreground">{step.message}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {failed && analysis.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {analysis.error}
          </div>
        )}

        {retryError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {retryError}
          </div>
        )}

        {showRetryActions && (
          <div className="flex flex-wrap items-center gap-2">
            {canRetry ? (
              <Button onClick={onRetry} disabled={busy}>
                {retryPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t("analysis.refreshStatus")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("analysis.retryUnavailable")}</p>
            )}
          </div>
        )}

        {failed && analysis.status === "BLOCKED" && (
          <div className="space-y-3">
            {canRetake ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("analysis.retakeHint", {
                    consistency: consistencyValue != null ? String(consistencyValue) : "<70",
                  })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={onEditAnswers} disabled={busy}>
                    {retakePending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {t("analysis.editAnswers")}
                  </Button>
                  <Button variant="secondary" onClick={onStartNew} disabled={busy}>
                    {retakePending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {t("analysis.startNew")}
                  </Button>
                  {canRetry && (
                    <Button variant="outline" onClick={onRetry} disabled={busy}>
                      {retryPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {t("analysis.refreshStatus")}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t("analysis.blockedHint")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepStatusIcon({ status }: { status: DiscAnalysisStepStatus }) {
  if (status === "RUNNING") {
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />;
  }
  if (status === "DONE") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />;
  }
  if (status === "FAILED" || status === "BLOCKED") {
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  }
  if (status === "SKIPPED") {
    return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />;
}

function ScoreResultView({
  result,
  meta,
  llmReport,
}: {
  result: DiscScoreResult;
  meta?: DiscHistoryItem | null;
  llmReport?: DiscLlmReport | null;
}) {
  const t = useT();
  const { user } = useAuth();
  const radar = DISC_DIMENSIONS.map((axis) => ({
    axis,
    value: result[`${axis}_percent`] ?? 0,
  }));
  const top = topDimension(result);
  const employeeEmail = meta?.user?.email ?? user?.email ?? "—";
  const statusKey = meta?.status
    ? participantStatusMessageKey(meta.status as DiscParticipantStatus)
    : null;
  const submittedLabel = meta?.submittedAt ? formatDateDdMmYyyy(meta.submittedAt) : "—";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("result.participantInfo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoRow label={t("result.employee")} value={employeeEmail} />
            <InfoRow label={t("result.session")} value={meta?.session.title ?? "—"} />
            <InfoRow
              label={t("result.status")}
              value={statusKey ? t(statusKey) : (meta?.status ?? "—")}
            />
            <InfoRow label={t("result.completedAt")} value={submittedLabel} />
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("result.radarTitle")}</CardTitle>
            <CardDescription>{t("result.radarDesc")}</CardDescription>
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
            <CardTitle className="text-lg">{t("result.dimensionScores")}</CardTitle>
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("result.aiAnalysis")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnalysisBlock title={t("result.trend")} accent="bg-sky-600">
            <TrendHighlights result={result} />
          </AnalysisBlock>
          {!llmReport ? (
            <p className="text-sm text-muted-foreground">{t("result.aiUnavailable")}</p>
          ) : (
            <>
              <AnalysisBlock title={t("result.profileSummary")} accent="bg-blue-700">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {llmReport.profileSummary}
                </p>
              </AnalysisBlock>
              <AnalysisBlock title={t("result.strengths")} accent="bg-emerald-700">
                <BulletList items={llmReport.strengths} />
              </AnalysisBlock>
              <AnalysisBlock title={t("result.improvements")} accent="bg-orange-600">
                <BulletList items={llmReport.improvements} />
              </AnalysisBlock>
              <AnalysisBlock title={t("result.workStyle")} accent="bg-purple-700">
                <BulletList items={llmReport.workStyle} />
              </AnalysisBlock>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-all">{value}</dd>
    </div>
  );
}

function formatDateDdMmYyyy(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function TrendHighlights({ result }: { result: DiscScoreResult }) {
  const t = useT();
  const ranked = DISC_DIMENSIONS.map((dimension) => ({
    dimension,
    percent: result[`${dimension}_percent`] ?? 0,
  })).sort((left, right) => right.percent - left.percent);
  const topPercent = ranked[0]?.percent ?? 0;
  const dominant = ranked.filter((item) => topPercent - item.percent <= 5);
  const supporting = ranked.find(
    (item) => !dominant.some((dominantItem) => dominantItem.dimension === item.dimension),
  );
  const items = [
    {
      label: t("result.dominantTrend"),
      value: dominant.map((item) => item.dimension).join(" / "),
      supporting: false,
    },
    ...(supporting
      ? [
          {
            label: t("result.supportingTrend"),
            value: supporting.dimension,
            supporting: true,
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className={cn(
            "rounded-xl border px-4 py-3",
            item.supporting
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-rose-500/45 bg-rose-500/10 shadow-sm",
          )}
        >
          <div
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              item.supporting
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300",
            )}
          >
            {item.label}
          </div>
          <div className="mt-1 text-base font-bold text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function AnalysisBlock({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex">
        <div className={cn("w-1 shrink-0", accent)} />
        <div className="min-w-0 flex-1 p-4">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <div className="mt-2 text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
