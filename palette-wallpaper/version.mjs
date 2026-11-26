// single source of truth for the app version (MSIX manifest + settings About page)
// NOTE: the Microsoft Store rejects packages whose 4th section (revision) is non-zero
// ("应用程序不得拥有版本，其版本号…非零" = revision must be 0). So from 1.0.3.0 on the
// build counter lives in the 3rd section: 1.0.3.0 → 1.0.4.0 → 1.0.5.0 …
export const VERSION = "1.0.3.0";
