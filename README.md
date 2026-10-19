# Event Translate

Traducción simultánea de eventos vía código QR. El orador habla; los asistentes escanean un QR y ven la traducción en vivo en su navegador, sin instalar nada.

## Cómo funciona

1. El orador abre la página principal en Chrome/Edge y crea un evento.
2. Se genera un código de evento (ej. `MDHS5J`) y su código QR.
3. Los asistentes escanean el QR → se abre `/e/<CÓDIGO>` en su móvil.
4. El orador pulsa **Iniciar transcripción**: la Web Speech API transcribe su voz en directo.
5. **La traducción la hace el ordenador principal (orador)**, en tandas de frases completas (solo las frases nuevas se traducen; las ya hechas salen de la caché):
   - Motor único: **Translator API de Chrome** (local, gratuita, on-device, requiere Chrome 138+). **Sin APIs externas de traducción**
   - Sin fallback: si el navegador del orador no soporta la API, la app avisa (se requiere Chrome/Edge 138+)
6. El texto traducido se difunde por WebSocket a los asistentes de cada idioma. Vista **proyector** (`/projector`) con subtítulos gigantes vía BroadcastChannel (últimas 3 líneas).

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite, componentes estilo 000h by Cojeev (`src/components/ui`)
- **Backend**: Express + WebSocket (`ws`), generación de QR (`qrcode`)
- **APIs**: Web Speech API (transcripción), Translator API de Chrome (traducción local, sin servicios externos), SpeechSynthesis (lectura en voz alta en el móvil del asistente)

## Desarrollo

```bash
npm install
npm run build   # compila el frontend a dist/
npm start       # sirve la app completa en http://localhost:3000
```

Desarrollo con hot-reload (dos terminales):

```bash
npm start            # backend en :3000
npx vite             # frontend en :5173 con proxy a /api
```

## Despliegue (Render)

- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- El QR se genera automáticamente con el dominio público (usa `x-forwarded-proto` y `Host`). Variable opcional `PUBLIC_BASE_URL` para forzarlo.

## Notas

- Los eventos expiran a las 24 h o al pulsar "Finalizar evento" (difunde `end` a los asistentes, cierra conexiones y borra el código).
- Translator API: activar `chrome://flags/#translation-api` si la versión lo requiere; los paquetes de idioma se descargan solos la primera vez.
