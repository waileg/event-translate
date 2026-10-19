import { useEffect, useRef, useState } from "react";
import { splitSentences } from "@/lib/translate";

interface SpeechResult {
  base: string;
  interim: string;
  sentences: string[];
}

export function useSpeechRecognition(langSpeech: string, active: boolean) {
  const [result, setResult] = useState<SpeechResult>({ base: "", interim: "", sentences: [] });
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    if (!active) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Este navegador no soporta reconocimiento de voz (Web Speech API). Usa Chrome o Edge.");
      return;
    }
    const recog = new SR();
    recogRef.current = recog;
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = langSpeech;

    recog.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) baseRef.current += t + " ";
        else interim += t;
      }
      const full = (baseRef.current + interim).trim();
      setResult({
        base: baseRef.current.trim(),
        interim,
        sentences: splitSentences(full),
      });
    };
    recog.onerror = (e: any) => setError(e.error);
    try {
      recog.start();
    } catch {}
    return () => {
      try {
        recog.stop();
      } catch {}
    };
  }, [active, langSpeech]);

  return { ...result, error, stop: () => { try { recogRef.current?.stop(); } catch {} } };
}
