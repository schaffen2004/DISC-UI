import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileQuestion, Clock, Loader2, Layers, Hash } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  discLevelLabel,
  getTemplate,
  type DiscQuestion,
} from "@/lib/api/disc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/questionnaires")({
  head: () => ({
    meta: [
      { title: "Questionnaires — DigiWork" },
      { name: "description", content: "Active DISC question bank template." },
    ],
  }),
  component: QuestionnairesPage,
});

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function QuestionnairesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeLevel, setActiveLevel] = useState<number | null>(null);

  const templateQuery = useQuery({
    queryKey: ["disc", "template"],
    queryFn: () => getTemplate(),
    enabled: isAuthenticated,
  });

  const template = templateQuery.data;

  useEffect(() => {
    if (!template?.levels?.length) return;
    setActiveLevel((cur) => (cur == null || !template.levels.includes(cur) ? template.levels[0] : cur));
  }, [template?.levels]);

  const questionsByLevel = useMemo(() => {
    const map = new Map<number, DiscQuestion[]>();
    for (const q of template?.questions ?? []) {
      const list = map.get(q.level) ?? [];
      list.push(q);
      map.set(q.level, list);
    }
    for (const [level, list] of map) {
      list.sort((a, b) => a.sourceId - b.sourceId || a.question.localeCompare(b.question));
      map.set(level, list);
    }
    return map;
  }, [template?.questions]);

  const levelQuestions = activeLevel == null ? [] : questionsByLevel.get(activeLevel) ?? [];
  const levelCount =
    template?.levelSummary.find((s) => s.level === activeLevel)?.count ?? levelQuestions.length;

  return (
    <StaffOnly>
    <AppShell>
      <div className="space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Questionnaires</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Active DISC question bank used by all assessment sessions.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link to="/assessments/new">Use in assessment</Link>
          </Button>
        </header>

        {!isAuthenticated && !authLoading && (
          <Card className="p-4 text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>{" "}
            to load the DISC template.
          </Card>
        )}

        {(authLoading || (isAuthenticated && templateQuery.isLoading)) && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading template…
          </div>
        )}

        {templateQuery.isError && (
          <Card className="p-4 text-sm text-destructive">
            {(templateQuery.error as Error)?.message || "Failed to load template"}
          </Card>
        )}

        {template && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileQuestion className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle>DISC Question Bank</CardTitle>
                      <CardDescription>
                        Version {template.bank.version}
                        {template.bank.isActive ? " · Active" : " · Inactive"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      template.bank.isActive ? "border-[var(--success)]/30 text-[var(--success)]" : ""
                    }
                  >
                    {template.bank.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" /> Questions
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">
                      {template.questionCount}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" /> Levels
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">
                      {template.levels.join(", ")}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Created
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {formatDate(template.bank.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Bank ID</div>
                    <div className="mt-1 truncate font-mono text-xs" title={template.bank.id}>
                      {template.bank.id}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Question preview</CardTitle>
                <CardDescription>Browse questions by DISC level.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {template.levelSummary.map((item) => {
                    const active = activeLevel === item.level;
                    return (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => setActiveLevel(item.level)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground",
                        )}
                      >
                        Level {item.level}
                        <span className={cn("ml-1.5", active ? "opacity-80" : "opacity-60")}>
                          ({item.count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeLevel != null && (
                  <div className="rounded-lg border bg-muted/20 px-4 py-3">
                    <div className="text-sm font-medium">
                      Level {activeLevel} · {discLevelLabel[activeLevel] ?? "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {levelCount} question{levelCount === 1 ? "" : "s"}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {levelQuestions.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No questions for this level.
                    </p>
                  )}
                  {levelQuestions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{String(idx + 1).padStart(2, "0")}</Badge>
                        <Badge variant="secondary">
                          Level {q.level} · {discLevelLabel[q.level] ?? ""}
                        </Badge>
                        <span className="text-xs text-muted-foreground">source #{q.sourceId}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{q.question}</p>
                      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {q.options
                          .slice()
                          .sort((a, b) => a.ordinal - b.ordinal)
                          .map((opt) => (
                            <li
                              key={opt.id}
                              className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                            >
                              <span className="mr-1.5 font-medium text-foreground">
                                {opt.ordinal}.
                              </span>
                              {opt.value}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
    </StaffOnly>
  );
}
