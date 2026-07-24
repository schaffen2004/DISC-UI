import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  variant?: "icon" | "button";
  className?: string;
};

function nextLocale(locale: Locale): Locale {
  return locale === "vi" ? "en" : "vi";
}

export function LanguageSwitcher({ variant = "icon", className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const next = nextLocale(locale);
  const nextLabel = LOCALES.find((l) => l.code === next)?.short ?? next.toUpperCase();
  const currentLabel = LOCALES.find((l) => l.code === locale)?.short ?? locale.toUpperCase();

  const toggle = () => setLocale(next);

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={toggle}
        aria-label={t("common.language")}
        title={`${t("common.language")}: ${nextLabel}`}
      >
        <Languages className="h-4 w-4" />
        {currentLabel}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      onClick={toggle}
      aria-label={t("common.language")}
      title={`${t("common.language")}: ${nextLabel}`}
    >
      <Languages className="h-4 w-4" />
      <span className="absolute -bottom-0.5 -right-0.5 rounded bg-muted px-0.5 text-[9px] font-semibold leading-none text-muted-foreground">
        {currentLabel}
      </span>
    </Button>
  );
}
