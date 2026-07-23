import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  FileQuestion,
  Send,
  Loader2,
  Search,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import { createSession, openSession } from "@/lib/api/disc";
import {
  listUsers,
  userDisplayName,
  userInitials,
  type UserListItem,
} from "@/lib/api/users";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assessments/new")({
  head: () => ({
    meta: [
      { title: "New Assessment — DigiWork" },
      { name: "description", content: "Create and send a new DISC assessment to your team." },
    ],
  }),
  component: NewAssessment,
});

const steps = [
  { id: 1, label: "Details", icon: FileQuestion },
  { id: 2, label: "Assignees", icon: Users },
  { id: 3, label: "Review & Send", icon: Send },
];

function NewAssessment() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Record<string, UserListItem>>({});
  const [openAfterCreate, setOpenAfterCreate] = useState(true);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const usersQuery = useQuery({
    queryKey: ["users", "all", "assignees", { search }],
    queryFn: () => listUsers({ search, page: 1, limit: 100 }),
    enabled: isAuthenticated,
  });

  const users = useMemo(() => {
    const list = usersQuery.data?.data ?? [];
    // Owner manages the session; assignees are participants only.
    return list.filter((u) => u.id !== user?.id);
  }, [usersQuery.data, user?.id]);

  const selectedIds = Object.keys(selected);
  const selectedUsers = Object.values(selected);

  const canContinueStep1 = title.trim().length > 0;
  const canContinueStep2 = selectedIds.length > 0;

  const toggleUser = (userItem: UserListItem, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (on) next[userItem.id] = userItem;
      else delete next[userItem.id];
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      setStep(1);
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one participant.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSession({
        title: title.trim(),
        description: description.trim() || undefined,
        participantIds: selectedIds,
      });
      if (openAfterCreate && created?.id) {
        await openSession(created.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["disc", "sessions"] });
      navigate({ to: "/assessments" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create assessment";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StaffOnly>
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            to="/assessments"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All assessments
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
            Create Assessment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a DISC session and invite participants.
          </p>
        </div>

        {!isAuthenticated && (
          <Card className="p-4 text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>{" "}
            to create an assessment.
          </Card>
        )}

        <Card className="p-4">
          <ol className="flex items-center gap-2 overflow-x-auto">
            {steps.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <li key={s.id} className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                      active && "bg-primary text-primary-foreground border-primary",
                      done && "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
                      !active && !done && "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                    {s.label}
                  </button>
                  {i < steps.length - 1 && <div className="hidden sm:block h-px w-6 bg-border" />}
                </li>
              );
            })}
          </ol>
        </Card>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Assessment details</CardTitle>
              <CardDescription>Name the session and add optional context for participants.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Đánh giá DISC quý 3/2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea
                  id="desc"
                  placeholder="Add context so participants know what to expect…"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Questionnaire is fixed by the active DISC question bank on the server.
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Assign participants</CardTitle>
              <CardDescription>{selectedIds.length} selected</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search users by name, email, phone…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  disabled={!isAuthenticated}
                />
              </div>

              {usersQuery.isLoading && (
                <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                </div>
              )}

              {usersQuery.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {(usersQuery.error as Error)?.message || "Failed to load users"}
                </div>
              )}

              {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
              )}

              <div className="grid gap-2 sm:grid-cols-2 max-h-[420px] overflow-y-auto pr-1">
                {users.map((u) => {
                  const isOn = Boolean(selected[u.id]);
                  const name = userDisplayName(u);
                  return (
                    <label
                      key={u.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                        isOn ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={isOn}
                        onCheckedChange={(v) => toggleUser(u, Boolean(v))}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {userInitials(u)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.role ? ` · ${u.role}` : ""}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review and send</CardTitle>
              <CardDescription>Confirm details before creating the DISC session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4 md:col-span-2">
                  <div className="text-xs text-muted-foreground">Title</div>
                  <div className="mt-1 font-medium">{title.trim() || "—"}</div>
                </div>
                <div className="rounded-lg border p-4 md:col-span-2">
                  <div className="text-xs text-muted-foreground">Description</div>
                  <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {description.trim() || "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Participants</div>
                  <div className="mt-1 font-medium">{selectedIds.length} people</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Initial status</div>
                  <div className="mt-1 font-medium">{openAfterCreate ? "OPEN" : "DRAFT"}</div>
                </div>
              </div>

              {selectedUsers.length > 0 && (
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium mb-3">Selected participants</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {userInitials(u)}
                          </AvatarFallback>
                        </Avatar>
                        {userDisplayName(u)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer">
                <Checkbox
                  checked={openAfterCreate}
                  onCheckedChange={(v) => setOpenAfterCreate(Boolean(v))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">Open session after create</div>
                  <div className="text-xs text-muted-foreground">
                    If unchecked, session stays DRAFT until you open it later.
                  </div>
                </div>
              </label>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || submitting}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2) || submitting
              }
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!isAuthenticated || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {openAfterCreate ? "Create & open" : "Create draft"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
    </StaffOnly>
  );
}
