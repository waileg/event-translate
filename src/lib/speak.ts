import { LANGS } from "./translate";

let enabled = false;
let queue: { text: string; lang: string }[] = [];
let speaking = false;
let lastSpoken = "";
let rate = 1;

export function setSpeechRate(r: number) {
  rate = r;
}

export function isSpeechEnabled() {
  return enabled;
}

/** El usuario debe activarlo con un tap (los navegadores exigen interaccion). */
export function enableSpeech() {
  enabled = true;
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
  if (queue.length && !speaking) speakNext();
}

export function disableSpeech() {
  enabled = false;
  queue = [];
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Encola una frase para leerla en voz alta. Solo lee texto nuevo. */
export function speakSentence(text: string, lang: string) {
  if (!enabled || !text) return;
  const fresh = text.startsWith(lastSpoken) && lastSpoken ? text.slice(lastSpoken.length).trim() : text;
  if (!fresh) return;
  lastSpoken = text;
  queue.push({ text: fresh, lang });
  if (!speaking) speakNext();
}

function speakNext() {
  if (!enabled || !queue.length) {
    speaking = false;
    return;
  }
  if (!("speechSynthesis" in window)) {
    speaking = false;
    return;
  }
  speaking = true;
  const item = queue.shift()!;
  const speechLang = LANGS.find((l) => l.value === item.lang)?.speech || "en-US";
  const u = new SpeechSynthesisUtterance(item.text);
  u.lang = speechLang;
  u.rate = rate;
  u.onend = () => speakNext();
  u.onerror = () => speakNext();
  window.speechSynthesis.speak(u);
}
