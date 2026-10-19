export const LANGS = [
  { value: "es", label: "Español", speech: "es-ES" },
  { value: "en", label: "English", speech: "en-US" },
  { value: "fr", label: "Français", speech: "fr-FR" },
  { value: "de", label: "Deutsch", speech: "de-DE" },
  { value: "it", label: "Italiano", speech: "it-IT" },
  { value: "pt", label: "Português", speech: "pt-PT" },
] as const;

export type LangCode = (typeof LANGS)[number]["value"];

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const translationCache = new Map<string, string>();
const translators = new Map<string, Translator | null>();
let translatorCreating = new Map<string, Promise<Translator | null>>();

export function translatorAvailable(): boolean {
  return typeof window !== "undefined" && "Translator" in window;
}

async function getTranslator(from: string, to: string): Promise<Translator | null> {
  const key = `${from}>${to}`;
  if (translators.has(key)) return translators.get(key)!;
  if (!translatorAvailable()) return null;
  try {
    const status = await Translator.availability({ sourceLanguage: from, targetLanguage: to });
    if (status !== "available" && status !== "downloadable" && status !== "downloading") {
      translators.set(key, null);
      return null;
    }
    const p = Translator.create({ sourceLanguage: from, targetLanguage: to });
    translatorCreating.set(key, p);
    const t = await p;
    translators.set(key, t);
    return t;
  } catch {
    translators.set(key, null);
    return null;
  } finally {
    translatorCreating.delete(key);
  }
}

/**
 * Traduce UNA frase completa usando SOLO la Translator API local del navegador
 * (on-device, gratuita, sin llamadas a ningun servicio externo).
 * Lanza error si el navegador no la soporta o el par de idiomas no esta disponible.
 */
export async function translateSentence(
  sentence: string,
  from: string,
  to: string,
): Promise<string> {
  const cacheKey = `${from}>${to}:${sentence}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey)!;

  const tr = await getTranslator(from, to);
  if (!tr) {
    throw new Error("no-local-translator");
  }
  const translated = await tr.translate(sentence);
  translationCache.set(cacheKey, translated);
  return translated;
}
