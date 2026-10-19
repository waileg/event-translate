import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANGS } from "@/lib/translate";
import { enableSpeech, disableSpeech, speakSentence, setSpeechRate } from "@/lib/speak";

export default function Viewer({ code }: { code: string }) {
  const [lang, setLang] = useState<string>(() => localStorage.getItem("et_lang") || "en");
  const [translated, setTranslated] = useState("Esperando al orador…");
  const [original, setOriginal] = useState("");
  const [status, setStatus] = useState("Conectando…");
  const [ended, setEnded] = useState(false);
  const [speechOn, setSpeechOn] = useState(false);
  const [rate, setRate] = useState(() => Number(localStorage.getItem("et_rate")) || 1);
  const wsRef = useRef<WebSocket | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?event=${code}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus("Conectado");
        ws.send(JSON.stringify({ type: "lang", lang: langRef.current }));
      };
      ws.onclose = () => {
        if (closed || ended) return;
        setStatus("Reconectando…");
        retry = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "end") {
          setEnded(true);
          setStatus("Evento finalizado");
          setTranslated("El orador ha finalizado el evento. ¡Gracias por asistir!");
          setOriginal("");
          return;
        }
        if (msg.type === "translation" && msg.lang === langRef.current) {
          setTranslated(msg.text);
          speakSentence(msg.text, langRef.current);
        } else if (msg.type === "speech") {
          setOriginal(msg.text);
        }
      };
    }
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, [code]);

  function toggleSpeech() {
    if (speechOn) {
      disableSpeech();
      setSpeechOn(false);
    } else {
      enableSpeech();
      setSpeechOn(true);
    }
  }

  function changeRate(value: number) {
    setRate(value);
    setSpeechRate(value);
    localStorage.setItem("et_rate", String(value));
  }

  function changeLang(value: string) {
    setLang(value);
    localStorage.setItem("et_lang", value);
    setTranslated("Cambiando idioma…");
    wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "lang", lang: value }));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-3">
          <Badge className="text-base">{code}</Badge>
          <Select className="w-40" value={lang} onChange={(e) => changeLang(e.target.value)}>
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </header>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`inline-block h-2 w-2 rounded-full ${ended ? "bg-slate-600" : "bg-emerald-400 shadow-[0_0_8px_#34d399]"}`} />
          {status}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-slate-400">Traducción en vivo</CardTitle></CardHeader>
          <CardContent className="text-2xl leading-snug min-h-16">{translated}</CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Button variant={speechOn ? "destructive" : "default"} onClick={toggleSpeech}>
              {speechOn ? "🔇 Detener voz" : "🔊 Leer en voz alta"}
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Velocidad</span>
              {[1, 1.25, 1.5].map((r) => (
                <button
                  key={r}
                  onClick={() => changeRate(r)}
                  className={`px-2 py-1 rounded ${rate === r ? "bg-sky-500 text-slate-950 font-semibold" : "bg-slate-800 text-slate-300"}`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-slate-400">Texto original</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-400 leading-relaxed max-h-40 overflow-y-auto">{original}</CardContent>
        </Card>
        <footer className="text-center text-[11px] text-slate-600 pt-2">
          Event Translate — mantén esta pantalla abierta durante el evento
        </footer>
      </div>
    </div>
  );
}
