import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import { createSession, openSession } from "@/lib/api/disc";

export const Route = createFileRoute("/assessments/new")({
  head: () => ({
    meta: [
      { title: "New Assessment — DigiWork" },
      { name: "description", content: "Create a new DISC assessment session." },
    ],
  }),
  component: NewAssessment,
});

function NewAssessment() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openAfterCreate, setOpenAfterCreate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0;

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      // No invitees on create — OPEN sessions are open enrollment for all members.
      const created = await createSession({
        title: title.trim(),
        description: description.trim() || undefined,
        participantIds: [],
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
        <div className="mx-auto max-w-2xl space-y-6">
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
              Create a session without inviting anyone. When it is OPEN, any member can take it.
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

          <Card>
            <CardHeader>
              <CardTitle>Assessment details</CardTitle>
              <CardDescription>
                Name the session. Members join automatically while it stays open.
              </CardDescription>
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
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                No need to add users here. Optional invites can be added later from session details.
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" asChild disabled={submitting}>
              <Link to="/assessments">Cancel</Link>
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isAuthenticated || !canSubmit || submitting}
            >
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
          </div>
        </div>
      </AppShell>
    </StaffOnly>
  );
}
