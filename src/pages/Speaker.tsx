import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LANGS, translateBatch, translatorAvailable } from "@/lib/translate";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
}

export default function Speaker() {
  const [sourceLang, setSourceLang] = useState<string>("es");
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [viewerUrl, setViewerUrl] = useState<string>("");
  const [listening, setListening] = useState(false);
  const [langs, setLangs] = useState<Set<string>>(new Set());
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const lastTranslatedCount = useRef<Record<string, number>>({});

  const langSpeech = LANGS.find((l) => l.value === sourceLang)?.speech || "es-ES";
  const speech = useSpeechRecognition(langSpeech, listening);
  const fullText = (speech.base + " " + speech.interim).trim();

  async function createEvent() {
    const r = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLang }),
    });
    const { code } = await r.json();
    setEventCode(code);
    setQrUrl(`/api/events/${code}/qr`);
    setViewerUrl(`${location.origin}/e/${code}`);
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?event=${code}`);
    wsRef.current = ws;
    bcRef.current = new BroadcastChannel("event-translate-" + code);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "lang") {
        setLangs((prev) => new Set(prev).add(msg.lang));
      }
    };
  }

  // Traduccion por tandas: solo frases nuevas
  useEffect(() => {
    if (!eventCode || !listening) return;
    const sentences = speech.sentences;
    if (!sentences.length) return;
    let cancelled = false;
    (async () => {
      for (const lang of langs) {
        const prev = lastTranslatedCount.current[lang] || 0;
        if (sentences.length <= prev) continue; // nada nuevo
        const done = sentences.slice(0, prev).join(" ");
        const todo = sentences.slice(prev).join(" ");
        try {
          const translated = await translateBatch(todo, sourceLang, lang);
          if (cancelled) return;
          const merged = ((translations[lang] ? translations[lang] + " " : "") + translated).trim();
          setTranslations((p) => ({ ...p, [lang]: merged }));
          lastTranslatedCount.current[lang] = sentences.length;
          wsRef.current?.readyState === 1 &&
            wsRef.current.send(JSON.stringify({ type: "translation", lang, text: merged, isFinal: true }));
        } catch {
          // los reintentos ocurriran en el siguiente tick de voz
        }
      }
    })();
    return () => { cancelled = true; };
  }, [speech.sentences.join("|"), langs, listening]);

  // Broadcast al proyector
  useEffect(() => {
    if (bcRef.current && fullText) {
      bcRef.current.postMessage({ type: "subtitle", text: fullText });
    }
  }, [fullText]);

  // Difundir tambien el texto original por WebSocket
  useEffect(() => {
    if (wsRef.current?.readyState === 1 && fullText) {
      wsRef.current.send(JSON.stringify({ type: "speech", text: fullText, isFinal: !speech.interim }));
    }
  }, [fullText]);

  async function endEvent() {
    speech.stop();
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
    }
    setTimeout(() => location.reload(), 700);
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">
          Event <span className="text-sky-400">Translate</span> — Consola del orador
        </h1>

        {!eventCode ? (
          <Card>
            <CardHeader>
              <CardTitle>Crear evento</CardTitle>
              <CardDescription>Elige el idioma en el que vas a hablar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                {LANGS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </Select>
              <Button className="w-full" size="lg" onClick={createEvent}>Crear evento</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex items-center justify-between pt-6">
                <Badge className="text-base tracking-widest px-4 py-1">{eventCode}</Badge>
                <Button
                  variant={listening ? "destructive" : "default"}
                  onClick={() => setListening((v) => !v)}
                  disabled={!SpeechRecognition}
                >
                  {listening ? "⏹ Detener transcripción" : "🎤 Iniciar transcripción"}
                </Button>
              </CardContent>
              <CardContent className="flex items-center gap-2 text-sm text-slate-400 pt-0">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${listening ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-600"}`} />
                {listening ? "Transmitiendo en directo" : "Sin transmitir"}
                {translatorAvailable() ? (
                  <Badge variant="outline" className="ml-2">Translator API local</Badge>
                ) : (
                  <Badge variant="outline" className="ml-2">MyMemory (servidor)</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col items-center gap-3 pt-6">
                <img src={qrUrl} alt="Código QR del evento" className="w-56 h-56 rounded-lg bg-white p-2" />
                <a className="text-sky-400 text-xs break-all" href={viewerUrl} target="_blank" rel="noreferrer">{viewerUrl}</a>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(`/projector.html?event=${eventCode}`, "_blank")}
                >
                  🖥️ Abrir vista proyector
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Transcripción en vivo</CardTitle></CardHeader>
              <CardContent className="text-lg leading-relaxed">
                {speech.base}
                <span className="text-slate-500">{speech.interim}</span>
              </CardContent>
            </Card>

            {[...langs].map((lang) => {
              const label = LANGS.find((l) => l.value === lang)?.label || lang;
              return (
                <Card key={lang}>
                  <CardHeader><CardTitle>Traducción ({label})</CardTitle></CardHeader>
                  <CardContent className="text-lg leading-relaxed">
                    {translations[lang] || "…"}
                  </CardContent>
                </Card>
              );
            })}

            <Button variant="destructive" className="w-full" onClick={endEvent}>Finalizar evento</Button>
          </>
        )}
      </div>
    </div>
  );
}
