import { useEffect, useState } from "react";
import { splitSentences } from "@/lib/translate";

const MAX_LINES = 3;

export default function Projector({ code }: { code: string }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const channel = new BroadcastChannel("event-translate-" + (code || "default"));
    channel.onmessage = (e) => {
      const msg = e.data;
      if (msg.type !== "subtitle") return;
      const text = (msg.text || "").trim();
      if (!text) return;
      setLines(splitSentences(text).slice(-MAX_LINES));
    };
    return () => channel.close();
  }, [code]);

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <header className="flex justify-between px-4 py-2.5 text-xs text-slate-500">
        <span>Event Translate — <b className="text-sky-400">Proyector</b></span>
        <span>{code ? `Evento ${code}` : ""}</span>
      </header>
      <main className="flex-1 flex items-end justify-center p-[4vw]">
        <div className="text-[4.5vw] leading-snug text-center max-w-[90vw] [text-shadow:0_2px_8px_#000] space-y-1">
          {lines.length === 0 ? (
            <span className="text-slate-700">Esperando al orador…</span>
          ) : (
            lines.map((l, i) => (
              <p key={`${i}-${l.slice(0, 12)}`} className={i === lines.length - 1 ? "" : i === 0 && lines.length === MAX_LINES ? "opacity-35" : "opacity-55"}>
                {l}
              </p>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
