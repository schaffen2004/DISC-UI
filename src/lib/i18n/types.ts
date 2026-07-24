export type Locale = "en" | "vi";

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "vi", label: "Tiếng Việt", short: "VI" },
];

export const LOCALE_STORAGE_KEY = "nw:locale";

export const defaultLocale: Locale = "vi";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}
