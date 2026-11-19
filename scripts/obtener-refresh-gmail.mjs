#!/usr/bin/env node
// Saca, una sola vez, el refresh token de Gmail con el que la app manda los
// correos de las citas (src/lib/notificaciones/correo.ts).
//
//   node scripts/obtener-refresh-gmail.mjs
//
// 1. Usa el mismo cliente OAuth de Google Calendar: GOOGLE_CLIENT_ID y
//    GOOGLE_CLIENT_SECRET (de .env.local, del entorno o te los pide).
// 2. Imprime una URL con el alcance gmail.send. Ábrela con la cuenta
//    remitente (GMAIL_SENDER) y acepta.
// 3. Google regresa a http://localhost:8085/ y el script canjea el código.
//    Si ese regreso no está dado de alta en el cliente OAuth (error
//    redirect_uri_mismatch), agrégalo en Google Cloud > Credenciales >
//    URIs de redireccionamiento autorizados, o pega aquí el código a mano.
// 4. Imprime el refresh token. Pégalo en Vercel como GMAIL_REFRESH_TOKEN
//    (Production y Preview). NUNCA lo guardes en un archivo del repo.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createInterface } from "node:readline";

const PUERTO = Number(process.env.GMAIL_PUERTO || 8085);
const REDIRECCION = process.env.GMAIL_REDIRECT_URI || `http://localhost:${PUERTO}/`;
const ALCANCE = "https://www.googleapis.com/auth/gmail.send";

function leerEnv() {
  const env = {};
  for (const archivo of [".env.local", ".env"]) {
    let texto;
    try {
      texto = readFileSync(archivo, "utf8");
    } catch {
      continue;
    }
    for (const linea of texto.split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || env[m[1]] !== undefined) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const preguntar = (q) => new Promise((r) => rl.question(q, (x) => r(x.trim())));

const env = { ...leerEnv(), ...process.env };
const clientId = env.GOOGLE_CLIENT_ID || (await preguntar("GOOGLE_CLIENT_ID: "));
const clientSecret = env.GOOGLE_CLIENT_SECRET || (await preguntar("GOOGLE_CLIENT_SECRET: "));
const remitente = env.GMAIL_SENDER || "";
if (!clientId || !clientSecret) {
  console.error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET.");
  process.exit(1);
}

const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECCION,
  response_type: "code",
  scope: ALCANCE,
  access_type: "offline",
  prompt: "consent",
  ...(remitente ? { login_hint: remitente } : {}),
}).toString();

console.log("\n1) Abre esta URL con la cuenta remitente y acepta el permiso de enviar correo:\n");
console.log(url.toString());
console.log(`\n2) Espero el regreso en ${REDIRECCION} (o pega el código abajo).\n`);

const codigo = await new Promise((resolver) => {
  const servidor = createServer((req, res) => {
    const u = new URL(req.url, REDIRECCION);
    const c = u.searchParams.get("code");
    const error = u.searchParams.get("error");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(c ? "<p>Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</p>" : `<p>No llegó el código (${error ?? "sin detalle"}).</p>`);
    if (c) {
      servidor.close();
      resolver(c);
    }
  });
  servidor.on("error", () => console.log(`(No pude abrir el puerto ${PUERTO}; pega el código a mano.)`));
  servidor.listen(PUERTO, "127.0.0.1");
  preguntar("Código (déjalo vacío si el navegador regresó solo): ").then((c) => {
    if (c) {
      servidor.close();
      resolver(decodeURIComponent(c));
    }
  });
});

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code: codigo,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECCION,
    grant_type: "authorization_code",
  }),
});
const datos = await res.json();
rl.close();

if (!res.ok || !datos.refresh_token) {
  console.error("\nGoogle no entregó refresh token:", datos.error_description || datos.error || datos);
  console.error("Revisa que aceptaste el permiso y que la URL llevaba prompt=consent.");
  process.exit(1);
}

console.log("\n3) Refresh token (secreto: pégalo sólo en Vercel como GMAIL_REFRESH_TOKEN):\n");
console.log(datos.refresh_token);
console.log("\nY define también GMAIL_SENDER con la cuenta con la que aceptaste.\n");
process.exit(0);
