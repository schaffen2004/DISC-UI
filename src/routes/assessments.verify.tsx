import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import { getSessionOverview, getVerification, submitVerification } from "@/lib/api/disc";

const searchSchema = z.object({
  sessionId: z.string().uuid().optional(),
  participantId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/assessments/verify")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Manager verification — DigiWork" },
      {
        name: "description",
        content: "Complete Level 5 manager validation for a submitted DISC assessment.",
      },
    ],
  }),
  component: VerifyPage,
});

function answersPayload(answers: Record<string, string>) {
  return {
    answers: Object.entries(answers).map(([questionId, optionId]) => ({
      questionId,
      optionId,
    })),
  };
}

function VerifyPage() {
  const { sessionId, participantId } = Route.useSearch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const verificationQuery = useQuery({
    queryKey: ["disc", "verification", sessionId, participantId],
    queryFn: () => getVerification(sessionId!, participantId!),
    enabled: Boolean(isAuthenticated && sessionId && participantId),
  });

  const overviewQuery = useQuery({
    queryKey: ["disc", "session", sessionId, "overview"],
    queryFn: () => getSessionOverview(sessionId!),
    enabled: Boolean(isAuthenticated && sessionId),
  });

  useEffect(() => {
    if (!verificationQuery.data || prefilled) return;
    const draft: Record<string, string> = {};
    for (const a of verificationQuery.data.answers) {
      draft[a.questionId] = a.optionId;
    }
    setAnswers(draft);
    setPrefilled(true);
    if (verificationQuery.data.questions.length > 0) {
      const firstUnanswered = verificationQuery.data.questions.findIndex((q) => !draft[q.id]);
      setI(firstUnanswered >= 0 ? firstUnanswered : 0);
    }
  }, [verificationQuery.data, prefilled]);

  const participant = overviewQuery.data?.participants.find((p) => p.id === participantId);
  const alreadyVerified = participant?.status === "VERIFIED";

  const submitMutation = useMutation({
    mutationFn: () => submitVerification(sessionId!, participantId!, answersPayload(answers)),
    onSuccess: async () => {
      setActionError(null);
      setDone(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["disc", "session", sessionId, "overview"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["disc", "verification", sessionId, participantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["disc", "result", participantId],
        }),
      ]);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Failed to submit verification",
      );
    },
  });

  const allAnswered = useMemo(() => {
    const questions = verificationQuery.data?.questions ?? [];
    return questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));
  }, [verificationQuery.data?.questions, answers]);

  if (!sessionId || !participantId) {
    return (
      <CenteredMessage
        title="Missing parameters"
        body="Open verification with sessionId and participantId, or pick a submitted participant from Assessments."
        action={
          <Button asChild>
            <Link to="/assessments">Back to assessments</Link>
          </Button>
        }
      />
    );
  }

  if (!isAuthenticated && !authLoading) {
    return (
      <CenteredMessage
        title="Sign in required"
        body="You need to be signed in as the session manager to verify assessments."
        action={
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        }
      />
    );
  }

  if (authLoading || verificationQuery.isLoading) {
    return (
      <CenteredMessage
        title="Loading verification"
        body={
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Fetching Level 5 questions…
          </span>
        }
      />
    );
  }

  if (verificationQuery.isError) {
    const message =
      verificationQuery.error instanceof Error
        ? verificationQuery.error.message
        : "Something went wrong";
    const isNotSubmitted = message.includes("PARTICIPANT_HAS_NOT_SUBMITTED");
    return (
      <CenteredMessage
        title={isNotSubmitted ? "Not ready to verify" : "Could not load verification"}
        body={isNotSubmitted ? "This participant has not submitted their assessment yet." : message}
        action={
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => verificationQuery.refetch()}>
              Retry
            </Button>
            <Button asChild>
              <Link to="/assessments">Back</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (alreadyVerified && !done) {
    return (
      <CenteredMessage
        title="Already verified"
        body="Manager validation for this participant is already complete."
        action={
          <div className="flex gap-2 justify-center">
            <Button asChild>
              <Link to="/assessments/result" search={{ participantId }}>
                View result
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/assessments">Back</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const questions = verificationQuery.data?.questions ?? [];
  const total = questions.length;

  if (total === 0) {
    return (
      <CenteredMessage
        title="No verification questions"
        body="Level 5 manager validation questions are not available for this session."
        action={
          <Button asChild>
            <Link to="/assessments">Back to assessments</Link>
          </Button>
        }
      />
    );
  }

  const q = questions[Math.min(i, total - 1)];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const pct = Math.round((answeredCount / total) * 100);
  const sessionTitle = overviewQuery.data?.title ?? "DISC Assessment";
  const employeeLabel = participant?.user.email ?? "Employee";
  const isBusy = submitMutation.isPending;

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="text-center animate-fade-in max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Verification complete</h1>
          <p className="mt-2 text-muted-foreground">
            Manager validation has been submitted. The participant status is now Verified.
          </p>
          <div className="mt-8 flex justify-center gap-2">
            <Button asChild size="lg">
              <Link to="/assessments/result" search={{ participantId }}>
                View result
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/assessments">Back to assessments</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-background/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{sessionTitle}</div>
              <div className="truncate text-xs text-muted-foreground">
                Verify · {employeeLabel} · Level 5
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/assessments">Cancel</Link>
          </Button>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              Question {i + 1} of {total}
            </span>
            <span className="font-medium tabular-nums text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-14">
        <Card className="p-6 sm:p-10 animate-fade-in" key={q.id}>
          <div className="text-xs font-medium uppercase tracking-widest text-primary">
            Manager validation · Question {String(i + 1).padStart(2, "0")}
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
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
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

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0 || isBusy}
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>
          {i === total - 1 ? (
            <Button onClick={() => submitMutation.mutate()} disabled={!allAnswered || isBusy}>
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Submit verification
            </Button>
          ) : (
            <Button onClick={() => setI(i + 1)} disabled={!answers[q.id] || isBusy}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
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
