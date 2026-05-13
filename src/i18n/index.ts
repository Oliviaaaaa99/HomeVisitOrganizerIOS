// Tiny i18n: a Context + hook. Two languages, ~30 lines of state — i18next
// would be overkill. Keys live in en.ts; zh.ts mirrors the shape so a missing
// translation surfaces as a TypeScript error at build time.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Dict } from "./en";
import { zh } from "./zh";

export type Lang = "en" | "zh";

const STORAGE_KEY = "hvo.lang";
const DICTS: Record<Lang, Dict> = { en, zh };

function detectDeviceLang(): Lang {
  // expo-localization returns BCP-47 tags like "zh-Hans-CN" or "en-US"; we
  // only care about the primary subtag.
  const tag = Localization.getLocales()[0]?.languageCode ?? "en";
  return tag.toLowerCase().startsWith("zh") ? "zh" : "en";
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, ...args: Array<string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectDeviceLang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "zh") setLangState(saved);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, ...args: Array<string | number>) => {
      const dict = DICTS[lang];
      const parts = key.split(".");
      let cur: unknown = dict;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in (cur as object)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          // Missing translation — fall back to the key so a regression is
          // visible in the UI rather than crashing.
          return key;
        }
      }
      if (typeof cur !== "string") return key;
      // {0}, {1}, … placeholders.
      return cur.replace(/\{(\d+)\}/g, (_, i) => {
        const v = args[Number(i)];
        return v === undefined ? `{${i}}` : String(v);
      });
    },
    [lang],
  );

  const value = useMemo<Ctx>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <LanguageProvider>");
  return ctx;
}

// Helpers for the few values that aren't simple keys:

export function unitTypeLabel(t: Ctx["t"], unitType: string): string {
  switch (unitType) {
    case "Studio":
    case "studio":
      return t("unitType.studio");
    case "1B":
      return t("unitType.oneBed");
    case "2B":
      return t("unitType.twoBed");
    case "3B":
      return t("unitType.threeBed");
    case "condo":
      return t("unitType.condo");
    case "townhouse":
      return t("unitType.townhouse");
    case "sfh":
      return t("unitType.sfh");
    case "apartment":
      return t("unitType.apartment");
    default:
      return unitType;
  }
}

export function statusLabel(t: Ctx["t"], status: string): string {
  switch (status) {
    case "toured":
      return t("status.toured");
    case "shortlisted":
      return t("status.shortlisted");
    case "rejected":
      return t("status.rejected");
    case "archived":
      return t("status.archived");
    default:
      return status.replace("_", " ");
  }
}

export function kindLabel(t: Ctx["t"], kind: string): string {
  if (kind === "rental") return t("kind.rental");
  if (kind === "for_sale") return t("kind.for_sale");
  return kind.replace("_", " ");
}
