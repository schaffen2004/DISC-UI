export type { Locale } from "./types";
export type { MessageKey } from "./messages";
export { LOCALES, LOCALE_STORAGE_KEY, defaultLocale, isLocale } from "./types";
export { messages } from "./messages";
export { LocaleProvider, useI18n, useT } from "./context";

import type { MessageKey } from "./messages";

export function sessionStatusMessageKey(status: "DRAFT" | "OPEN" | "CLOSED"): MessageKey {
  return `session.status.${status}` as MessageKey;
}

export function participantStatusMessageKey(
  status: "INVITED" | "IN_PROGRESS" | "SUBMITTED" | "VERIFIED",
): MessageKey {
  return `participant.status.${status}` as MessageKey;
}

export function discLevelMessageKey(level: number): MessageKey {
  const key = `disc.level.${level}` as MessageKey;
  return key;
}

export function userStatusMessageKey(
  label: "New" | "Active" | "Locked" | string,
): MessageKey {
  if (label === "New" || label === "Active" || label === "Locked") {
    return `user.status.${label}` as MessageKey;
  }
  return "user.status.New";
}
