import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getAssessment, getSession } from "@/lib/api/disc";

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

function QuestionnairePage() {
  const { sessionId } = Route.useSearch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const assessmentQuery = useQuery({
    queryKey: ["disc", "assessment", sessionId],
    queryFn: () => getAssessment(sessionId!),
    enabled: Boolean(isAuthenticated && sessionId),
  });

  const sessionQuery = useQuery({
    queryKey: ["disc", "session", sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(isAuthenticated && sessionId),
  });

  useEffect(() => {
    if (!assessmentQuery.data || prefilled) return;
    const draft: Record<string, string> = {};
    for (const a of assessmentQuery.data.answers) {
      draft[a.questionId] = a.optionId;
    }
    setAnswers(draft);
    setPrefilled(true);
    if (assessmentQuery.data.questions.length > 0) {
      const firstUnanswered = assessmentQuery.data.questions.findIndex(
        (q) => !draft[q.id],
      );
      setI(firstUnanswered >= 0 ? firstUnanswered : 0);
    }
  }, [assessmentQuery.data, prefilled]);

  if (!sessionId) {
    return (
      <CenteredMessage
        title="Missing session"
        body="Open this page with a sessionId query parameter, or pick a session from Assessments."
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
        body="You need to be signed in to take an assessment."
        action={
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        }
      />
    );
  }

  if (authLoading || assessmentQuery.isLoading) {
    return (
      <CenteredMessage
        title="Loading assessment"
        body={
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Fetching questions…
          </span>
        }
      />
    );
  }

  if (assessmentQuery.isError) {
    return (
      <CenteredMessage
        title="Could not load assessment"
        body={
          assessmentQuery.error instanceof Error
            ? assessmentQuery.error.message
            : "Something went wrong"
        }
        action={
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => assessmentQuery.refetch()}>
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

  const questions = assessmentQuery.data?.questions ?? [];
  const total = questions.length;

  if (total === 0) {
    return (
      <CenteredMessage
        title="No questions"
        body="This session has no Level 1–4 questions available."
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
  const remaining = total - answeredCount;
  const remainingMinutes = Math.max(1, Math.ceil(remaining * 0.4));
  const title = sessionQuery.data?.title ?? "DISC Assessment";

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="text-center animate-fade-in max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Assessment complete</h1>
          <p className="mt-2 text-muted-foreground">
            Answers are ready locally. Submit to the API will be available in a later step. You can
            view a result once your manager has verified, or if one already exists.
          </p>
          <div className="mt-8 flex justify-center gap-2">
            {assessmentQuery.data?.participantId && (
              <Button asChild size="lg">
                <Link
                  to="/assessments/result"
                  search={{ participantId: assessmentQuery.data.participantId }}
                >
                  View my results
                </Link>
              </Button>
            )}
            <Button variant="outline" size="lg" asChild>
              <Link to="/">Back to dashboard</Link>
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
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{title}</div>
              <div className="truncate text-xs text-muted-foreground">
                Level {q.level} · {total} questions
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5 text-[var(--success)]" /> Draft loaded
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> ~{remainingMinutes} min remaining
            </span>
          </div>
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
            Question {String(i + 1).padStart(2, "0")} · Level {q.level}
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
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                      )}
                    </span>
                  </button>
                );
              })}
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>
          {i === total - 1 ? (
            <Button onClick={() => setDone(true)} disabled={!answers[q.id]}>
              Finish assessment <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setI(i + 1)} disabled={!answers[q.id]}>
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
