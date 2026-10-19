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

async function translateServer(text: string, from: string, to: string): Promise<string> {
  const r = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, from, to }),
  });
  if (!r.ok) throw new Error("translation service unavailable");
  return (await r.json()).text;
}

/**
 * Traduce UNA frase completa. Usa la cache; si no esta, usa la
 * Translator API local y si no, el servidor (MyMemory).
 */
export async function translateSentence(
  sentence: string,
  from: string,
  to: string,
): Promise<string> {
  const cacheKey = `${from}>${to}:${sentence}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey)!;

  let translated: string | null = null;
  const tr = await getTranslator(from, to);
  if (tr) {
    try {
      translated = await tr.translate(sentence);
    } catch {
      translators.set(`${from}>${to}`, null);
      translated = null;
    }
  }
  if (translated === null) {
    translated = await translateServer(sentence, from, to);
  }
  translationCache.set(cacheKey, translated);
  return translated;
}
