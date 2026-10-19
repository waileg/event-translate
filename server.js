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
app.use(express.static(path.join(__dirname, "public")));

// ---------- Estado en memoria ----------
const events = new Map(); // code -> { code, createdAt, sourceLang }
const rooms = new Map();  // code -> Set<ws>

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
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
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
    return res.status(404).sendFile(path.join(__dirname, "public", "notfound.html"));
  }
  res.sendFile(path.join(__dirname, "public", "viewer.html"));
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
    if (msg.type !== "speech") return;
    const payload = JSON.stringify({ type: "speech", text: msg.text, isFinal: !!msg.isFinal });
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
    }
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Event Translate escuchando en http://localhost:${PORT}`);
});
