import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, Save, Sparkles } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import {
  getAssessment,
  getSession,
  saveAssessmentDraft,
  submitAssessment,
  type DiscQuestion,
} from "@/lib/api/disc";
import { useT } from "@/lib/i18n";

const searchSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/assessments/questionnaire")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "DISC Questionnaire — DigiWork" },
      { name: "description", content: "Complete your DISC behavioral assessment." },
    ],
  }),
  component: QuestionnairePage,
});

function answersPayload(answers: Record<string, string>, allowedQuestionIds?: Set<string>) {
  return {
    answers: Object.entries(answers)
      .filter(([questionId, optionId]) => {
        if (!questionId || !optionId) return false;
        if (allowedQuestionIds && !allowedQuestionIds.has(questionId)) return false;
        return true;
      })
      .map(([questionId, optionId]) => ({
        questionId,
        optionId,
      })),
  };
}

function QuestionnairePage() {
  const { sessionId } = Route.useSearch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftSavedCount, setDraftSavedCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const syncedAnswersKeyRef = useRef<string | null>(null);

  const assessmentQuery = useQuery({
    queryKey: ["disc", "assessment", sessionId],
    queryFn: () => getAssessment(sessionId!),
    enabled: Boolean(isAuthenticated && sessionId),
    refetchOnMount: "always",
  });

  const sessionQuery = useQuery({
    queryKey: ["disc", "session", sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(isAuthenticated && sessionId),
  });

  const questions: DiscQuestion[] = useMemo(
    () => assessmentQuery.data?.questions ?? [],
    [assessmentQuery.data?.questions],
  );

  const questionIds = useMemo(() => new Set(questions.map((q) => q.id)), [questions]);

  useEffect(() => {
    setAnswers({});
    setDraftDirty(false);
    setDone(false);
    setDraftSavedAt(null);
    setDraftSavedCount(0);
    setActionError(null);
    setQuestionIndex(0);
    syncedAnswersKeyRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!assessmentQuery.data || draftDirty) return;

    const serverAnswers = assessmentQuery.data.answers ?? [];
    const key = `${sessionId}:${serverAnswers
      .map((a) => `${a.questionId}=${a.optionId}`)
      .sort()
      .join("|")}`;
    if (syncedAnswersKeyRef.current === key) return;
    syncedAnswersKeyRef.current = key;

    const draft: Record<string, string> = {};
    for (const a of serverAnswers) {
      draft[a.questionId] = a.optionId;
    }
    setAnswers(draft);
    setDraftSavedCount(serverAnswers.length);
    if (serverAnswers.length > 0) {
      setDraftSavedAt(new Date());
    }

    const firstUnanswered = questions.findIndex((q) => !draft[q.id]);
    setQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : Math.max(0, questions.length - 1));
  }, [assessmentQuery.data, draftDirty, sessionId, questions]);

  const status = assessmentQuery.data?.status;
  const alreadySubmitted = status === "SUBMITTED" || status === "VERIFIED";

  const draftMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof answersPayload>) =>
      saveAssessmentDraft(sessionId!, payload),
    onSuccess: async (result, payload) => {
      const savedCount =
        typeof result?.answerCount === "number" ? result.answerCount : payload.answers.length;

      queryClient.setQueryData(
        ["disc", "assessment", sessionId],
        (prev: Awaited<ReturnType<typeof getAssessment>> | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: prev.status === "INVITED" ? "IN_PROGRESS" : prev.status,
            answers: payload.answers,
          };
        },
      );
      syncedAnswersKeyRef.current = `${sessionId}:${payload.answers
        .map((a) => `${a.questionId}=${a.optionId}`)
        .sort()
        .join("|")}`;

      setActionError(null);
      setDraftDirty(false);
      setDraftSavedCount(savedCount);
      setDraftSavedAt(new Date());

      await queryClient.invalidateQueries({
        queryKey: ["disc", "assessment", sessionId],
        refetchType: "active",
      });
      await queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] });
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t("questionnaire.saveDraftFailed"),
      );
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof answersPayload>) =>
      submitAssessment(sessionId!, payload),
    onSuccess: async () => {
      setActionError(null);
      setDone(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["disc", "assessment", sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["disc", "history", "me"] }),
      ]);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t("questionnaire.submitFailed"),
      );
    },
  });

  const allAnswered = useMemo(() => {
    return questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));
  }, [questions, answers]);

  if (!sessionId) {
    return (
      <CenteredMessage
        title={t("questionnaire.missingSession")}
        body={t("questionnaire.missingSessionBody")}
        action={
          <Button asChild>
            <Link to="/assessments">{t("questionnaire.backToAssessments")}</Link>
          </Button>
        }
      />
    );
  }

  if (!isAuthenticated && !authLoading) {
    return (
      <CenteredMessage
        title={t("questionnaire.signInRequired")}
        body={t("questionnaire.signInBody")}
        action={
          <Button asChild>
            <Link to="/login">{t("common.signIn")}</Link>
          </Button>
        }
      />
    );
  }

  if (authLoading || assessmentQuery.isLoading) {
    return (
      <CenteredMessage
        title={t("questionnaire.loading")}
        body={
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("questionnaire.fetching")}
          </span>
        }
      />
    );
  }

  if (assessmentQuery.isError) {
    return (
      <CenteredMessage
        title={t("questionnaire.loadFailed")}
        body={
          assessmentQuery.error instanceof Error
            ? assessmentQuery.error.message
            : t("questionnaire.somethingWrong")
        }
        action={
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => assessmentQuery.refetch()}>
              {t("common.retry")}
            </Button>
            <Button asChild>
              <Link to="/assessments">{t("common.back")}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (alreadySubmitted && !done) {
    return (
      <CenteredMessage
        title={t("questionnaire.alreadySubmitted")}
        body={t("questionnaire.alreadySubmittedBody")}
        action={
          <div className="flex gap-2 justify-center">
            {assessmentQuery.data?.participantId && (
              <Button asChild>
                <Link
                  to="/assessments/result"
                  search={{ participantId: assessmentQuery.data.participantId }}
                >
                  {t("questionnaire.viewResults")}
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/assessments">{t("common.back")}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const total = questions.length;

  if (total === 0) {
    return (
      <CenteredMessage
        title={t("questionnaire.noQuestions")}
        body={t("questionnaire.noQuestionsBody")}
        action={
          <Button asChild>
            <Link to="/assessments">{t("questionnaire.backToAssessments")}</Link>
          </Button>
        }
      />
    );
  }

  const safeIndex = Math.min(questionIndex, total - 1);
  const q = questions[safeIndex];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const pct = Math.round((answeredCount / total) * 100);
  const remaining = total - answeredCount;
  const remainingMinutes = Math.max(1, Math.ceil(remaining * 0.4));
  const title = sessionQuery.data?.title ?? "DISC Assessment";
  const isBusy = draftMutation.isPending || submitMutation.isPending;
  const isLast = safeIndex === total - 1;

  const selectAnswer = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: optionId }));
    setDraftDirty(true);
  };

  const goPrev = () => {
    if (safeIndex > 0) setQuestionIndex(safeIndex - 1);
  };

  const goNext = () => {
    if (!answers[q.id]) return;
    if (safeIndex < total - 1) setQuestionIndex(safeIndex + 1);
  };

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="text-center animate-fade-in max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            {t("questionnaire.submittedTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("questionnaire.submittedBody")}</p>
          <div className="mt-8 flex justify-center gap-2">
            {assessmentQuery.data?.participantId && (
              <Button asChild size="lg">
                <Link
                  to="/assessments/result"
                  search={{ participantId: assessmentQuery.data.participantId }}
                >
                  {t("questionnaire.viewResults")}
                </Link>
              </Button>
            )}
            <Button variant="outline" size="lg" asChild>
              <Link to="/">{t("questionnaire.backDashboard")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-background/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2" asChild>
            <Link
              to="/assessments"
              onClick={(e) => {
                if (!draftDirty) return;
                if (!window.confirm(t("questionnaire.leaveUnsavedConfirm"))) {
                  e.preventDefault();
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t("questionnaire.backToAssessments")}</span>
              <span className="sm:hidden">{t("common.back")}</span>
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2.5 sm:flex-1">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {total} questions · Likert scale
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                draftDirty && "text-[var(--warning)] font-medium",
              )}
            >
              {draftMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save
                  className={cn(
                    "h-3.5 w-3.5",
                    draftDirty ? "text-[var(--warning)]" : "text-[var(--success)]",
                  )}
                />
              )}
              {draftMutation.isPending
                ? t("questionnaire.savingDraft")
                : draftDirty
                  ? t("questionnaire.unsaved")
                  : draftSavedAt
                    ? t("questionnaire.draftSaved", {
                        count: draftSavedCount,
                        time: draftSavedAt.toLocaleTimeString(),
                      })
                    : t("questionnaire.draftHint")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />{" "}
              {t("questionnaire.remaining", { minutes: remainingMinutes })}
            </span>
          </div>
        </div>

        {draftDirty && (
          <div className="border-t border-[var(--warning)]/25 bg-[var(--warning)]/10">
            <p className="mx-auto max-w-3xl px-4 sm:px-6 py-2 text-xs sm:text-sm text-[var(--warning)]">
              {t("questionnaire.unsavedNotice")}
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-3 pt-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("questionnaire.overall", { answered: answeredCount, total })}</span>
            <span className="font-medium tabular-nums text-foreground">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                pct === 100 ? "bg-[var(--success)]" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-14">
        <Card className="p-6 sm:p-10 animate-fade-in" key={q.id}>
          <div className="text-xs font-medium uppercase tracking-widest text-primary">
            Question {String(safeIndex + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}
          </div>
          <h2 className="mt-4 text-xl sm:text-2xl font-semibold leading-snug tracking-tight">
            {q.question}
          </h2>

          <div className="mt-8 grid gap-2.5">
            {q.options
              .slice()
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((o) => {
                const active = answers[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => selectAnswer(o.id)}
                    className={cn(
                      "group flex items-center justify-between gap-4 rounded-xl border p-4 text-left text-sm transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:border-primary/50 hover:bg-muted/40",
                    )}
                  >
                    <span className="font-medium">{o.value}</span>
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        active ? "border-primary bg-primary" : "border-border",
                      )}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                    </span>
                  </button>
                );
              })}
          </div>
        </Card>

        {actionError && (
          <Card className="mt-4 border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {actionError}
          </Card>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={goPrev} disabled={safeIndex === 0 || isBusy}>
            <ArrowLeft className="h-4 w-4" /> {t("common.previous")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => draftMutation.mutate(answersPayload(answers, questionIds))}
              disabled={isBusy || answeredCount === 0}
            >
              {draftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("common.saveDraft")}
            </Button>
            {isLast ? (
              <Button
                onClick={() => submitMutation.mutate(answersPayload(answers, questionIds))}
                disabled={!allAnswered || isBusy}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t("questionnaire.submitAssessment")}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!answers[q.id] || isBusy}>
                {t("common.next")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {answeredCount}/{total} answered
          {draftSavedCount > 0
            ? ` · ${t("questionnaire.savedRatio", { saved: draftSavedCount, total })}`
            : ""}
          {draftDirty ? ` · ${t("questionnaire.unsaved")}` : ""}
        </p>
      </main>
    </div>
  );
}

function CenteredMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="text-sm text-muted-foreground">{body}</div>
        {action}
      </div>
    </div>
  );
}
