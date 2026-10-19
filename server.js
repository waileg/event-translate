import express from "express";
import { WebSocketServer } from "ws";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

const dist = path.join(__dirname, "dist");
const legacyPublic = path.join(__dirname, "public");
const hasDist = (await import("node:fs")).existsSync(dist);
if (hasDist) {
  app.use(express.static(dist));
} else {
  app.use(express.static(legacyPublic));
}

// ---------- Estado en memoria ----------
const events = new Map(); // code -> { code, createdAt, sourceLang }
const rooms = new Map();  // code -> Set<ws>
const roomLangs = new Map(); // code -> Set<lang> (idiomas que piden los asistentes)

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return events.has(code) ? makeCode() : code;
}

// ---------- API ----------
app.post("/api/events", (req, res) => {
  const code = makeCode();
  events.set(code, { code, createdAt: Date.now(), sourceLang: req.body?.sourceLang || "es" });
  rooms.set(code, new Set());
  roomLangs.set(code, new Set());
  res.json({ code });
});

app.get("/api/events/:code", (req, res) => {
  const ev = events.get(req.params.code);
  if (!ev) return res.status(404).json({ error: "Evento no encontrado" });
  res.json(ev);
});

app.get("/api/events/:code/qr", async (req, res) => {
  const ev = events.get(req.params.code);
  if (!ev) return res.status(404).json({ error: "Evento no encontrado" });
  let base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    const proto = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.headers.host || `localhost:${PORT}`;
    base = `${proto}://${host}`;
  }
  const url = `${base}/e/${ev.code}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 400, margin: 2 });
    res.type("image/png").send(png);
  } catch {
    res.status(500).json({ error: "No se pudo generar el QR" });
  }
});

// Vista del asistente
app.get("/e/:code", (req, res) => {
  if (!events.has(req.params.code)) {
    if (hasDist) {
      return res.status(404).send("<!doctype html><html lang=es><body style='font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh'><div style=text-align:center><h1>Evento no encontrado</h1><p>El QR ha caducado o el evento ha finalizado.</p></div></body></html>");
    }
    return res.status(404).sendFile(path.join(__dirname, "public", "notfound.html"));
  }
  if (hasDist) return res.sendFile(path.join(dist, "index.html"));
  res.sendFile(path.join(__dirname, "public", "viewer.html"));
});

app.get("/projector", (req, res) => {
  if (hasDist) return res.sendFile(path.join(dist, "index.html"));
  res.redirect("/projector.html");
});

app.get("*", (req, res, next) => {
  if (hasDist && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(dist, "index.html"));
  }
  next();
});

// ---------- Traduccion (MyMemory, gratuito, con cache) ----------
const translationCache = new Map();

app.post("/api/translate", async (req, res) => {
  const { text, from, to } = req.body || {};
  if (!text || !to || !from) return res.status(400).json({ error: "Faltan parametros" });
  const key = `${from}>${to}:${text}`;
  if (translationCache.has(key)) return res.json({ text: translationCache.get(key) });

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    const translated = data?.responseData?.translatedText;
    if (!translated) throw new Error("Respuesta invalida");
    translationCache.set(key, translated);
    res.json({ text: translated });
  } catch {
    res.status(502).json({ error: "Servicio de traduccion no disponible" });
  }
});

// ---------- WebSockets ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const code = new URL(req.url, "http://x").searchParams.get("event");
  if (!code || !rooms.has(code)) {
    ws.close(4004, "Evento no encontrado");
    return;
  }
  rooms.get(code).add(ws);
  console.log(`[ws] cliente en evento ${code} (${rooms.get(code).size} conectados)`);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "lang") {
      // El asistente pide un idioma: registrar y avisar al orador
      const langs = roomLangs.get(code);
      if (langs && msg.lang && !langs.has(msg.lang)) {
        langs.add(msg.lang);
        const payload = JSON.stringify({ type: "lang", lang: msg.lang });
        for (const client of rooms.get(code)) {
          if (client.readyState === 1) client.send(payload);
        }
      }
      return;
    }

    if (msg.type === "end") {
      const payload = JSON.stringify({ type: "end" });
      for (const client of rooms.get(code) || []) {
        if (client.readyState === 1) client.send(payload);
      }
      setTimeout(() => {
        rooms.get(code)?.forEach((client) => client.close());
        events.delete(code);
        rooms.delete(code);
        roomLangs.delete(code);
        console.log(`[event] ${code} finalizado`);
      }, 500);
      return;
    }

    if (msg.type !== "speech" && msg.type !== "translation") return;
    const payload = JSON.stringify({ type: msg.type, lang: msg.lang, text: msg.text, isFinal: !!msg.isFinal });
    for (const client of rooms.get(code)) {
      if (client !== ws && client.readyState === 1) client.send(payload);
    }
  });

  ws.on("close", () => {
    const set = rooms.get(code);
    set?.delete(ws);
    console.log(`[ws] salida de evento ${code} (${set?.size || 0} conectados)`);
  });
});

setInterval(() => {
  const oneDay = 24 * 60 * 60 * 1000;
  for (const [code, ev] of events) {
    if (Date.now() - ev.createdAt > oneDay) {
      events.delete(code);
      rooms.get(code)?.forEach((ws) => ws.close());
      rooms.delete(code);
      roomLangs.delete(code);
    }
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Event Translate escuchando en http://localhost:${PORT}`);
});
