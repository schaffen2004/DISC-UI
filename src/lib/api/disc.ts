import { apiFetch, getApiBaseUrl, getStoredToken } from "./client";

export type DiscSessionStatus = "DRAFT" | "OPEN" | "CLOSED";
export type DiscParticipantStatus = "INVITED" | "IN_PROGRESS" | "SUBMITTED" | "VERIFIED";

export type DiscConsistencyLevel = "High" | "Acceptable" | "Unstable" | "Low";

/**
 * Flat score result from backend `scoreDisc()`.
 * Raw D/I/S/C are sums of 12 main Likert items (range 12–60).
 * Percent = ((raw - 12) / 48) * 100.
 */
export type DiscScoreResult = {
  D: number;
  I: number;
  S: number;
  C: number;
  D_percent: number;
  I_percent: number;
  S_percent: number;
  C_percent: number;
  consistency: number;
  consistency_level: DiscConsistencyLevel;
};

export type DiscSessionListItem = {
  id: string;
  title: string;
  description?: string | null;
  status: DiscSessionStatus;
  isManager: boolean;
  participantCount: number;
  myParticipant?: {
    id: string;
    status: DiscParticipantStatus;
  };
  createdAt: string;
};

export type DiscAnalysisStatus = "PENDING" | "RUNNING" | "BLOCKED" | "COMPLETED" | "FAILED";

export type DiscAnalysisStep =
  "CONSISTENCY" | "CONTRADICTION_CHECK" | "GROUP_SCORES" | "PROFILE_ANALYSIS" | "PDF_EXPORT";

export type DiscAnalysisStepStatus =
  "PENDING" | "RUNNING" | "DONE" | "SKIPPED" | "FAILED" | "BLOCKED";

export type DiscAnalysisStepTrace = {
  step: DiscAnalysisStep;
  order: number;
  label: string;
  status: DiscAnalysisStepStatus;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  data?: Record<string, unknown>;
};

export type DiscLlmReport = {
  trend: string;
  profileSummary: string;
  strengths: string[];
  improvements: string[];
  workStyle: string[];
  consistency: string;
};

export type DiscAnalysis = {
  status: DiscAnalysisStatus;
  currentStep: DiscAnalysisStep | null;
  progress: {
    done: number;
    total: number;
    percent: number;
  };
  steps: DiscAnalysisStepTrace[];
  error: string | null;
  contradictionReport: unknown | null;
  pdfReady: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  scoreResult: DiscScoreResult | null;
  llmReport: DiscLlmReport | null;
};

export type DiscSubmitResult = {
  participantId: string;
  analysis: {
    status: DiscAnalysisStatus;
    steps: DiscAnalysisStepTrace[];
  };
};

export type DiscHistoryItem = {
  participantId: string;
  session: {
    id: string;
    title: string;
    createdAt: string;
  };
  status: DiscParticipantStatus;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  result?: DiscScoreResult | null;
  analysis?: DiscAnalysis | null;
  algorithmVersion?: string | null;
  user?: {
    id: string;
    email: string;
    phoneNumber?: string | null;
  } | null;
};

export const DISC_ANALYSIS_STEPS: DiscAnalysisStep[] = [
  "CONSISTENCY",
  "CONTRADICTION_CHECK",
  "GROUP_SCORES",
  "PROFILE_ANALYSIS",
  "PDF_EXPORT",
];

export function isAnalysisInProgress(status?: DiscAnalysisStatus | null) {
  return status === "PENDING" || status === "RUNNING";
}

export function isAnalysisTerminal(status?: DiscAnalysisStatus | null) {
  return status === "COMPLETED" || status === "BLOCKED" || status === "FAILED";
}

/** Backend only allows retry when FAILED due to a connection error. */
export function isAnalysisConnectionRetryable(analysis?: DiscAnalysis | null) {
  if (!analysis || analysis.status !== "FAILED") return false;
  return /connection error/i.test(analysis.error || "");
}

/** Retake is allowed when analysis is BLOCKED because consistency is below 70%. */
export function isConsistencyRetakeAllowed(analysis?: DiscAnalysis | null) {
  if (!analysis || analysis.status !== "BLOCKED") return false;
  const consistency = analysis.scoreResult?.consistency;
  if (typeof consistency === "number" && Number.isFinite(consistency)) {
    return consistency < 70;
  }
  return /consistency\s+\d+(?:\.\d+)?%\s*<\s*70/i.test(analysis.error || "");
}

export type DiscAnalysisRetryResult = {
  participantId: string;
  resumedFrom: DiscAnalysisStep;
  status: DiscAnalysisStatus;
};

export type DiscRetakeMode = "edit" | "new";

export type DiscRetakeResult = {
  participantId: string;
  sessionId: string;
  mode: DiscRetakeMode;
  answersCleared: boolean;
};

export type DiscQuestionOption = {
  id: string;
  ordinal: number;
  value: string;
};

export type DiscQuestion = {
  id: string;
  sourceId: string;
  question: string;
  options: DiscQuestionOption[];
};

export type DiscAssessment = {
  participantId: string;
  status: DiscParticipantStatus;
  questions: DiscQuestion[];
  answers: Array<{ questionId: string; optionId: string }>;
};

export type DiscTemplateBank = {
  id: string;
  version: number;
  checksum: string;
  isActive: boolean;
  createdAt: string;
};

export type DiscTemplate = {
  bank: DiscTemplateBank;
  questionCount: number;
  questions: DiscQuestion[];
};

export function getTemplate() {
  return apiFetch<DiscTemplate>("/disc/template");
}

export type CreateDiscSessionPayload = {
  title: string;
  description?: string;
  /** Optional — OPEN sessions allow any member to self-enroll. */
  participantIds?: string[];
};

export type CreateDiscSessionResult = {
  id: string;
  status: DiscSessionStatus;
};

export function listSessions() {
  return apiFetch<DiscSessionListItem[]>("/disc/sessions");
}

/**
 * OPERATOR sees sessions they manage, are in, or that are OPEN (open enrollment).
 * ADMIN / others keep the full API list.
 */
export function filterSessionsForRole(sessions: DiscSessionListItem[], role?: string | null) {
  const r = (role ?? "").trim().toUpperCase();
  if (r === "OPERATOR") {
    return sessions.filter((s) => s.isManager || Boolean(s.myParticipant) || s.status === "OPEN");
  }
  return sessions;
}

export function createSession(payload: CreateDiscSessionPayload) {
  return apiFetch<CreateDiscSessionResult>("/disc/sessions", {
    method: "POST",
    body: payload,
  });
}

export function openSession(sessionId: string) {
  return apiFetch(`/disc/sessions/${sessionId}/open`, {
    method: "POST",
  });
}

export function closeSession(sessionId: string) {
  return apiFetch(`/disc/sessions/${sessionId}/close`, {
    method: "POST",
  });
}

/** DRAFT: replace full list. OPEN: append new invitees only. */
export function updateSessionParticipants(sessionId: string, participantIds: string[]) {
  return apiFetch(`/disc/sessions/${sessionId}/participants`, {
    method: "PATCH",
    body: { participantIds },
  });
}

export function getMyHistory() {
  return apiFetch<DiscHistoryItem[]>("/disc/history/me");
}

export function getSession(sessionId: string) {
  return apiFetch<DiscSessionListItem & { owner?: { id: string; email: string } }>(
    `/disc/sessions/${sessionId}`,
  );
}

export type DiscPublicUser = {
  id: string;
  email: string;
  phoneNumber?: string | null;
};

export type DiscSessionOverviewParticipant = {
  id: string;
  user: DiscPublicUser;
  status: DiscParticipantStatus;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  result?: DiscScoreResult | null;
};

export type DiscSessionOverview = {
  id: string;
  title: string;
  description?: string | null;
  status: DiscSessionStatus;
  isManager: boolean;
  owner?: DiscPublicUser;
  participantCount: number;
  createdAt: string;
  openedAt?: string | null;
  closedAt?: string | null;
  participants: DiscSessionOverviewParticipant[];
};

export function getSessionOverview(sessionId: string) {
  return apiFetch<DiscSessionOverview>(`/disc/sessions/${sessionId}/overview`);
}

export function getAssessment(sessionId: string) {
  return apiFetch<DiscAssessment>(`/disc/sessions/${sessionId}/assessment`);
}

export type DiscAnswerItem = {
  questionId: string;
  optionId: string;
};

export type SaveDiscAnswersPayload = {
  answers: DiscAnswerItem[];
};

export function saveAssessmentDraft(sessionId: string, payload: SaveDiscAnswersPayload) {
  return apiFetch<{ answerCount: number }>(`/disc/sessions/${sessionId}/assessment/draft`, {
    method: "PUT",
    body: payload,
  });
}

export function submitAssessment(sessionId: string, payload: SaveDiscAnswersPayload) {
  return apiFetch<DiscSubmitResult>(`/disc/sessions/${sessionId}/assessment/submit`, {
    method: "POST",
    body: payload,
  });
}

export function getResult(participantId: string) {
  return apiFetch<DiscHistoryItem>(`/disc/results/${participantId}`);
}

/** Poll analysis pipeline progress for UI tracing. */
export function getAnalysisStatus(participantId: string) {
  return apiFetch<DiscAnalysis | null>(`/disc/results/${participantId}/analysis`);
}

/** Resume analysis from the failed step (connection errors only). */
export function retryAnalysis(participantId: string) {
  return apiFetch<DiscAnalysisRetryResult>(`/disc/results/${participantId}/analysis/retry`, {
    method: "POST",
  });
}

/** Reopen assessment after low consistency: edit kept answers or start new. */
export function retakeAssessment(participantId: string, mode: DiscRetakeMode) {
  return apiFetch<DiscRetakeResult>(`/disc/results/${participantId}/retake`, {
    method: "POST",
    body: { mode },
  });
}

export function getResultPdfUrl(participantId: string) {
  return `${getApiBaseUrl()}/disc/results/${participantId}/pdf`;
}

/** Download DISC result PDF from API (`GET /disc/results/:participantId/pdf`). */
export async function downloadResultPdf(
  participantId: string,
  filename = `disc-report-${participantId}.pdf`,
) {
  const token = getStoredToken();
  const res = await fetch(getResultPdfUrl(participantId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = `Failed to download PDF (${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      if (typeof payload.message === "string") message = payload.message;
      else if (Array.isArray(payload.message) && payload.message[0]) {
        message = payload.message[0];
      }
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const sessionStatusLabel: Record<DiscSessionStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Active",
  CLOSED: "Closed",
};

export const participantStatusLabel: Record<DiscParticipantStatus, string> = {
  INVITED: "Invited",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
};

/** Helper to extract the highest-scoring dimension from a flat score result. */
export function topDimension(result?: DiscScoreResult | null): "D" | "I" | "S" | "C" | null {
  if (!result) return null;
  let best: "D" | "I" | "S" | "C" = "D";
  for (const k of ["I", "S", "C"] as const) {
    if ((result[`${k}_percent`] ?? 0) > (result[`${best}_percent`] ?? 0)) best = k;
  }
  return best;
}

export const DISC_DIMENSIONS = ["D", "I", "S", "C"] as const;
export type DiscDimension = (typeof DISC_DIMENSIONS)[number];

export const discDimensionName: Record<DiscDimension, string> = {
  D: "Dominance",
  I: "Influence",
  S: "Steadiness",
  C: "Compliance",
};
