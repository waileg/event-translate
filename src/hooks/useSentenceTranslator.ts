import { useEffect, useRef, useState } from "react";
import { splitSentences, translateSentence, type LangCode } from "@/lib/translate";

/**
 * Traduce frases COMPLETAS (con puntuacion final) en cuanto cierran.
 * La frase en curso (sin punto) queda pendiente hasta cerrarse.
 * Una sola frase en vuelo por idioma; las demas se encolan.
 */
export function useSentenceTranslator(sentences: string[], sourceLang: string, langs: string[]) {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const doneRef = useRef<Record<string, string[]>>({}); // lang -> frases traducidas
  const inflightRef = useRef<Set<string>>(new Set());
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;

  useEffect(() => {
    let cancelled = false;

    for (const lang of langs) {
      const done = doneRef.current[lang] || (doneRef.current[lang] = []);

      const complete = sentences.filter(
        (s, i) => /[.!?…]\s*$/.test(s) && i < sentences.length - (/[.!?…]\s*$/.test(sentences[sentences.length - 1]) ? 0 : 1),
      );

      for (const s of complete) {
        if (done.includes(s)) continue;
        if (inflightRef.current.has(`${lang}:${s}`)) continue;
        inflightRef.current.add(`${lang}:${s}`);
        const sentence = s;
        translateSentence(sentence, sourceLang, lang)
          .then((t) => {
            if (cancelled) return;
            const list = doneRef.current[lang];
            if (!list.includes(sentence)) list.push(sentence);
            setTranslations((prev) => ({
              ...prev,
              [lang]: [...(prev[lang] || []), t].join(" "),
            }));
          })
          .catch(() => {})
          .finally(() => inflightRef.current.delete(`${lang}:${sentence}`));
      }
    }
    return () => {
      cancelled = true;
    };
  }, [sentences.join("|"), langs.join(","), sourceLang]);

  return translations;
}
