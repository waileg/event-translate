# Event Translate

Traducción simultánea de eventos vía código QR. El orador habla; los asistentes escanean un QR y ven la traducción en vivo en su navegador, sin instalar nada.

## Cómo funciona

1. El orador abre la página principal en Chrome/Edge (escritorio) y crea un evento.
2. Se genera un código de evento (ej. `MDHS5J`) y su código QR.
3. Los asistentes escanean el QR → se abre `/e/<CÓDIGO>` en su móvil.
4. El orador pulsa **Iniciar transcripción**: el navegador (Web Speech API) transcribe su voz en directo.
5. El texto viaja por WebSocket a todos los asistentes conectados, y cada uno lo ve traducido a su idioma elegido.

## Ejecutar

```bash
npm install
npm start          # http://localhost:3000
PORT=8080 npm start   # puerto personalizado
PUBLIC_BASE_URL=https://tu-dominio.com npm start  # URL dentro del QR en producción
```

## Componentes

- `server.js` — Express + WebSocket (`ws`). API de eventos, generación de QR (`qrcode`), endpoint de traducción y difusión por salas.
- `public/index.html` — Consola del orador: crea evento, muestra QR, captura voz con Web Speech API y envía el texto por WebSocket.
- `public/viewer.html` — Vista del asistente: recibe el texto, traduce (MyMemory API, gratuita, con caché) y muestra la traducción en vivo.
- `public/notfound.html` — QR caducado o evento inexistente.

## APIs utilizadas

- **Speech-to-text**: Web Speech API del navegador (gratuita, requiere Chrome/Edge y permiso de micrófono; en producción se puede sustituir por Whisper/Deepgram en el servidor).
- **Traducción**: [MyMemory](https://mymemory.translated.net) (gratuita, sin API key, con límite de uso diario por IP). Sustituible por DeepL/Google Translate cambiando el endpoint `/api/translate` en `server.js`.

## Notas

- Los eventos expiran a las 24 h (limpieza automática en memoria).
- El idioma de origen se fija al crear el evento; el asistente elige el idioma destino (se recuerda en `localStorage`).
- Para HTTPS (necesario para el micrófono en móviles y para que el QR funcione desde el móvil), despliega detrás de un proxy con TLS.
