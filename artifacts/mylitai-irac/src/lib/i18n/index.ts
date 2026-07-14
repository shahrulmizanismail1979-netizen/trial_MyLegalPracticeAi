import { common } from "./common";
import { home } from "./home";
import { library } from "./library";
import { tools } from "./tools";
import { features } from "./features";

export const translations = {
  en: { ...common.en, ...home.en, ...library.en, ...tools.en, ...features.en },
  ms: { ...common.ms, ...home.ms, ...library.ms, ...tools.ms, ...features.ms },
} as const;

export type TranslationKey = keyof typeof translations.en;
