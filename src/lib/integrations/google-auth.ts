import { createSign } from "node:crypto";

// ---------------------------------------------------------------------------
// Obtención de tokens de acceso de Google sin dependencias.
//
// `google-auth-library` + `googleapis` arrastran decenas de megas al bundle del
// servidor para, en el fondo, firmar un JWT y hacer un POST. Aquí se hace
// exactamente eso con el módulo `crypto` de Node:
//
//   · GA4 usa una **cuenta de servicio**: se firma un JWT RS256 y se canjea.
//   · Google Ads usa un **refresh token** de usuario: se canjea directamente.
//
// Los tokens se cachean en memoria del proceso hasta un minuto antes de
// caducar; una función de Vercel atiende muchas peticiones con la misma
// instancia, así que esto evita un viaje a Google en cada carga del panel.
// ---------------------------------------------------------------------------

const ENDPOINT_TOKEN = "https://oauth2.googleapis.com/token";

type TokenCacheado = { token: string; expiraEn: number };
const cache = new Map<string, TokenCacheado>();

function base64url(entrada: Buffer | string) {
  return Buffer.from(entrada)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function desdeCache(clave: string) {
  const entrada = cache.get(clave);
  if (entrada && entrada.expiraEn > Date.now() + 60_000) return entrada.token;
  return null;
}

function guardar(clave: string, token: string, segundos: number) {
  cache.set(clave, { token, expiraEn: Date.now() + segundos * 1000 });
  return token;
}

/**
 * La clave privada llega desde una variable de entorno, donde los saltos de
 * línea viajan escapados como `\n`. Sin esta normalización, `createSign` falla
 * con un error de PEM inválido que no dice nada útil.
 */
function normalizarClave(clave: string) {
  return clave.includes("\\n") ? clave.replace(/\\n/g, "\n") : clave;
}

/** Token de acceso para una cuenta de servicio (flujo JWT bearer). */
export async function tokenDeCuentaDeServicio(
  email: string,
  clavePrivada: string,
  scope: string
): Promise<string> {
  const clave = `sa:${email}:${scope}`;
  const cacheado = desdeCache(clave);
  if (cacheado) return cacheado;

  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: email,
      scope,
      aud: ENDPOINT_TOKEN,
      iat: ahora,
      exp: ahora + 3600,
    })
  );

  const firmador = createSign("RSA-SHA256");
  firmador.update(`${cabecera}.${cuerpo}`);
  const firma = base64url(firmador.sign(normalizarClave(clavePrivada)));
  const jwt = `${cabecera}.${cuerpo}.${firma}`;

  const res = await fetch(ENDPOINT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`No se pudo autenticar la cuenta de servicio (${res.status}): ${await res.text()}`);
  }

  const datos = (await res.json()) as { access_token: string; expires_in: number };
  return guardar(clave, datos.access_token, datos.expires_in);
}

/** Token de acceso a partir de un refresh token OAuth de usuario. */
export async function tokenDeRefresco(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const clave = `rt:${clientId}:${refreshToken.slice(-12)}`;
  const cacheado = desdeCache(clave);
  if (cacheado) return cacheado;

  const res = await fetch(ENDPOINT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`No se pudo renovar el token de Google (${res.status}): ${await res.text()}`);
  }

  const datos = (await res.json()) as { access_token: string; expires_in: number };
  return guardar(clave, datos.access_token, datos.expires_in);
}

/** Fecha en formato YYYY-MM-DD, que es el que aceptan ambas APIs. */
export function fechaISO(desplazamientoDias = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + desplazamientoDias);
  return d.toISOString().slice(0, 10);
}
