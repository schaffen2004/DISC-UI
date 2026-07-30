import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Search, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DiscBadge } from "@/components/disc-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  downloadResultPdf,
  getMyHistory,
  getSessionOverview,
  topDimension,
  type DiscParticipantStatus,
  type DiscScoreResult,
  type DiscSessionStatus,
} from "@/lib/api/disc";
import { participantStatusMessageKey, sessionStatusMessageKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Session report — DigiWork` },
      {
        name: "description",
        content: `DISC session report ${params.id}.`,
      },
    ],
  }),
  component: SessionReportPage,
});

const sessionStatusStyle: Record<DiscSessionStatus, string> = {
  OPEN: "bg-primary/10 text-primary border-primary/25",
  DRAFT: "bg-muted text-muted-foreground",
  CLOSED: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
};

const participantStatusStyle: Record<DiscParticipantStatus, string> = {
  INVITED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/25",
  SUBMITTED: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/25",
  VERIFIED: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25",
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
}

function emailName(email: string) {
  return email.split("@")[0] || email;
}

function initials(email: string) {
  const name = emailName(email);
  return name.slice(0, 2).toUpperCase();
}

function topScore(result?: DiscScoreResult | null) {
  if (!result) return null;
  return Math.round(
    Math.max(result.D_percent, result.I_percent, result.S_percent, result.C_percent),
  );
}

async function downloadPdf(participantId: string, filename: string) {
  await downloadResultPdf(participantId, filename);
}

function SessionReportPage() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffSessionReport /> : <MySessionReport />;
}

function MySessionReport() {
  const { id: sessionId } = Route.useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();

  const historyQuery = useQuery({
    queryKey: ["disc", "history", "me"],
    queryFn: getMyHistory,
    enabled: isAuthenticated,
  });

  const mine = (historyQuery.data ?? []).find((h) => h.session.id === sessionId);
  const disc = topDimension(mine?.result);
  const score = topScore(mine?.result);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("reports.backMine")}
          </Link>
        </div>

        {!isAuthenticated && !authLoading && (
          <Card className="p-4 text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t("common.signIn")}
            </Link>{" "}
            {t("reports.signInDetail")}
          </Card>
        )}

        {(authLoading || (isAuthenticated && historyQuery.isLoading)) && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("reports.loadingDetail")}
          </div>
        )}

        {historyQuery.isError && (
          <Card className="p-4 text-sm text-destructive">
            {(historyQuery.error as Error)?.message || t("reports.loadDetailFailed")}
          </Card>
        )}

        {isAuthenticated && !historyQuery.isLoading && !mine && (
          <Card className="p-6 text-center space-y-3">
            <h1 className="text-lg font-semibold">{t("reports.notAvailable")}</h1>
            <p className="text-sm text-muted-foreground">{t("reports.personalOnly")}</p>
            <Button asChild variant="outline">
              <Link to="/reports">{t("reports.backToMine")}</Link>
            </Button>
          </Card>
        )}

        {mine && (
          <>
            <header>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {mine.session.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("reports.personalResult")}</p>
            </header>

            <Card>
              <CardHeader>
                <CardTitle>{t("reports.yourParticipation")}</CardTitle>
                <CardDescription>
                  {t("employees.colStatus")} {t(participantStatusMessageKey(mine.status))}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("reports.status")}</div>
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className={cn("font-medium", participantStatusStyle[mine.status])}
                      >
                        {t(participantStatusMessageKey(mine.status))}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("reports.disc")}</div>
                    <div className="mt-1">{disc ? <DiscBadge type={disc} showLabel /> : "—"}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("reports.topScore")}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{score ?? "—"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {mine.result ? (
                    <>
                      <Button asChild>
                        <Link
                          to="/assessments/result"
                          search={{ participantId: mine.participantId }}
                        >
                          {t("reports.viewFullResult")}
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await downloadResultPdf(
                              mine.participantId,
                              `disc-report-${mine.session.title.replace(/[^\w-]+/g, "-").slice(0, 40)}.pdf`,
                            );
                          } catch (err) {
                            alert(err instanceof Error ? err.message : t("reports.pdfFailed"));
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                        {t("reports.downloadPdf")}
                      </Button>
                    </>
                  ) : (
                    <Button asChild>
                      <Link to="/assessments/questionnaire" search={{ sessionId: mine.session.id }}>
                        {t("reports.continueAssessment")}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StaffSessionReport() {
  const { id: sessionId } = Route.useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { locale, t } = useI18n();
  const [q, setQ] = useState("");
  const [pdfError, setPdfError] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["disc", "session", sessionId, "overview"],
    queryFn: () => getSessionOverview(sessionId),
    enabled: Boolean(isAuthenticated && sessionId),
  });

  const overview = overviewQuery.data;

  const participants = useMemo(() => {
    const list = overview?.participants ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => p.user.email.toLowerCase().includes(term));
  }, [overview?.participants, q]);

  const withResult = (overview?.participants ?? []).filter((p) => p.result).length;
  const verified = (overview?.participants ?? []).filter((p) => p.status === "VERIFIED").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("reports.backAll")}
          </Link>
        </div>

        {!isAuthenticated && !authLoading && (
          <Card className="p-4 text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t("common.signIn")}
            </Link>{" "}
            {t("reports.signInSessionDetail")}
          </Card>
        )}

        {(authLoading || (isAuthenticated && overviewQuery.isLoading)) && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("reports.loadingOverview")}
          </div>
        )}

        {overviewQuery.isError && (
          <Card className="p-4 text-sm text-destructive">
            {(overviewQuery.error as Error)?.message || t("reports.loadOverviewFailed")}
          </Card>
        )}

        {overview && (
          <>
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    {overview.title}
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn("font-medium", sessionStatusStyle[overview.status])}
                  >
                    {t(sessionStatusMessageKey(overview.status))}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {overview.description || t("reports.sessionReport")}
                </p>
              </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("reports.participants")}</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {overview.participantCount}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("reports.withResults")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{withResult}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("reports.verified")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{verified}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">{t("reports.created")}</div>
                <div className="mt-1 text-sm font-medium">
                  {formatDate(overview.createdAt, locale)}
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("reports.participantResults")}</CardTitle>
                <CardDescription>
                  {t("reports.resultsShown", {
                    shown: participants.length,
                    total: overview.participantCount,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("reports.searchEmail")}
                    className="pl-8"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>

                {pdfError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {pdfError}
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>{t("reports.participant")}</TableHead>
                        <TableHead>{t("reports.status")}</TableHead>
                        <TableHead>{t("reports.disc")}</TableHead>
                        <TableHead>{t("reports.topScore")}</TableHead>
                        <TableHead>{t("reports.submitted")}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-24 text-center text-sm text-muted-foreground"
                          >
                            {t("reports.noParticipantMatch")}
                          </TableCell>
                        </TableRow>
                      )}
                      {participants.map((p) => {
                        const disc = topDimension(p.result);
                        const score = topScore(p.result);
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {initials(p.user.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">
                                    {emailName(p.user.email)}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {p.user.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn("font-medium", participantStatusStyle[p.status])}
                              >
                                {t(participantStatusMessageKey(p.status))}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {disc ? (
                                <DiscBadge type={disc} />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums font-medium">
                              {score ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(p.submittedAt, locale)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {p.result ? (
                                  <>
                                    <Button asChild variant="outline" size="sm">
                                      <Link
                                        to="/assessments/result"
                                        search={{ participantId: p.id }}
                                      >
                                        {t("reports.view")}
                                      </Link>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        setPdfError(null);
                                        try {
                                          await downloadPdf(
                                            p.id,
                                            `disc-report-${emailName(p.user.email)}.pdf`,
                                          );
                                        } catch (err) {
                                          setPdfError(
                                            err instanceof Error
                                              ? err.message
                                              : t("reports.pdfFailed"),
                                          );
                                        }
                                      }}
                                    >
                                      <Download className="h-4 w-4" />
                                      PDF
                                    </Button>
                                  </>
                                ) : p.status !== "SUBMITTED" ? (
                                  <span className="text-xs text-muted-foreground">
                                    {t("reports.noResultYet")}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
