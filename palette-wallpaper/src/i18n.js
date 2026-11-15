// Tiny i18n layer: one JSON table, a tiny formatter, and helpers for <html data-i18n>.
import TABLE from "./i18n.json";

export const LANGS = ["zh", "en", "ja", "ko", "ru", "es", "pt", "de", "fr"];

/** Native names, so people can find their language even if the UI is in another one. */
export const LANG_NAMES = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  es: "Español",
  pt: "Português (BR)",
  de: "Deutsch",
  fr: "Français",
};

const two = (tag) => String(tag || "").toLowerCase().split("-")[0];

/** "auto" follows the system; anything unknown falls back to English. */
export function resolveLang(setting) {
  if (setting && setting !== "auto" && TABLE[setting]) return setting;
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
  for (const tag of list) if (TABLE[two(tag)]) return two(tag);
  return "en";
}

/** t("save") / t("fpsValue", { n: 30 }); missing keys fall back to English, then to the key itself. */
export function makeT(lang) {
  const table = TABLE[lang] || TABLE.en;
  return function (key, vars) {
    let s = table[key] != null ? table[key] : TABLE.en[key] != null ? TABLE.en[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  };
}

/** Fill every [data-i18n], [data-i18n-title] and [data-i18n-ph] under root. */
export function applyStatic(t, root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
  scope.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-ph"));
  });
}

export function detectSystemLang() {
  return resolveLang("auto");
}
