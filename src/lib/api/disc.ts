import { apiFetch, getApiBaseUrl, getStoredToken } from "./client";

export type DiscSessionStatus = "DRAFT" | "OPEN" | "CLOSED";
export type DiscParticipantStatus = "INVITED" | "IN_PROGRESS" | "SUBMITTED" | "VERIFIED";

export type DiscScores = {
  raw?: Record<"D" | "I" | "S" | "C", number>;
  percentage?: Record<"D" | "I" | "S" | "C", number>;
  dominantProfile?: string;
  totalLabelPoints?: number;
};

export type DiscResult = {
  id: string;
  adaptive: DiscScores;
  natural: DiscScores;
  pressure: DiscScores;
  motivatorFear: DiscScores;
  managerValidation?: DiscScores | null;
  naturalAdaptiveDelta?: Record<string, number>;
  managerDelta?: Record<string, number> | null;
  dominantProfile: string;
  algorithmVersion: string;
  calculatedAt: string;
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
  result?: DiscResult | null;
};

export type DiscQuestionOption = {
  id: string;
  ordinal: number;
  value: string;
};

export type DiscQuestion = {
  id: string;
  sourceId: number;
  level: number;
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

export type DiscTemplateLevelSummary = {
  level: number;
  count: number;
};

export type DiscTemplate = {
  bank: DiscTemplateBank;
  levels: number[];
  questionCount: number;
  levelSummary: DiscTemplateLevelSummary[];
  questions: DiscQuestion[];
};

export type GetDiscTemplateParams = {
  levels?: string;
  includeManager?: boolean;
};

export function getTemplate(params: GetDiscTemplateParams = {}) {
  const q = new URLSearchParams();
  if (params.levels) q.set("levels", params.levels);
  if (params.includeManager != null) q.set("includeManager", String(params.includeManager));
  const qs = q.toString();
  return apiFetch<DiscTemplate>(`/disc/template${qs ? `?${qs}` : ""}`);
}

export const discLevelLabel: Record<number, string> = {
  1: "Adaptive",
  2: "Natural",
  3: "Pressure",
  4: "Motivator / Fear",
  5: "Manager validation",
};

export type CreateDiscSessionPayload = {
  title: string;
  description?: string;
  participantIds: string[];
};

export type CreateDiscSessionResult = {
  id: string;
  status: DiscSessionStatus;
};

export function listSessions() {
  return apiFetch<DiscSessionListItem[]>("/disc/sessions");
}

/** OPERATOR only sees sessions they created or were invited to. ADMIN sees all. */
export function filterSessionsForRole(sessions: DiscSessionListItem[], role?: string | null) {
  const r = (role ?? "").trim().toUpperCase();
  if (r === "OPERATOR") {
    return sessions.filter((s) => s.isManager || Boolean(s.myParticipant));
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
  result?: DiscResult | null;
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

export function getResult(participantId: string) {
  return apiFetch<DiscHistoryItem>(`/disc/results/${participantId}`);
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
  CLOSED: "Completed",
};

export const participantStatusLabel: Record<DiscParticipantStatus, string> = {
  INVITED: "Invited",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
};

export function primaryDiscType(profile?: string | null): "D" | "I" | "S" | "C" | null {
  if (!profile) return null;
  const ch = profile.trim().charAt(0).toUpperCase();
  if (ch === "D" || ch === "I" || ch === "S" || ch === "C") return ch;
  return null;
}
