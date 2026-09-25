import { firmarJWT, tokenDeCuentaDeServicio } from "./google-auth";

// ---------------------------------------------------------------------------
// Tarjeta de lealtad en Google Wallet.
//
// Google Wallet modela un programa de lealtad con dos piezas:
//
//   · LoyaltyClass  — el programa (nombre del negocio, logo, color). Una sola.
//   · LoyaltyObject — la tarjeta de cada cliente (número, sellos, QR).
//
// El botón "Agregar a Google Wallet" es un enlace a
// https://pay.google.com/gp/v/save/<JWT>, donde el JWT —firmado con la clave
// de la cuenta de servicio del emisor— trae la clase y el objeto completos.
// Google los crea la primera vez que alguien lo abre; si ya existen, respeta
// los que tiene. Por eso, cuando cambian los sellos, además se hace un PATCH
// directo al objeto por la API REST: así la tarjeta que el cliente ya guardó
// se actualiza sola en su teléfono.
//
// Como el resto de integraciones, no usa `googleapis`: son un JWT y un PATCH.
// ---------------------------------------------------------------------------

const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const API = "https://walletobjects.googleapis.com/walletobjects/v1";

/** Lo que la interfaz envía para emitir o refrescar el pase de un cliente. */
export type DatosPase = {
  numero: string;
  titular: string;
  sellos: number;
  progreso: number;
  requerido: number;
  recompensasDisponibles: number;
  descuento: number;
  estado: "activa" | "suspendida";
  negocio: {
    nombre: string;
    direccion?: string;
    telefono?: string;
  };
};

function credenciales() {
  const emisor = process.env.GOOGLE_WALLET_ISSUER_ID;
  const email =
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const clave =
    process.env.GOOGLE_WALLET_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  return { emisor, email, clave };
}

/** Variables que faltan para poder emitir pases (vacío = listo). */
export function walletFaltantes(): string[] {
  const { emisor, email, clave } = credenciales();
  const faltan: string[] = [];
  if (!emisor) faltan.push("GOOGLE_WALLET_ISSUER_ID");
  if (!email) faltan.push("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  if (!clave) faltan.push("GOOGLE_WALLET_PRIVATE_KEY");
  return faltan;
}

export function walletConfigurado() {
  return walletFaltantes().length === 0;
}

/** Los ids de Wallet sólo admiten letras, números, `.`, `_` y `-`. */
function limpiar(valor: string) {
  return valor.replace(/[^\w.-]/g, "_");
}

function idClase() {
  const sufijo = limpiar(process.env.GOOGLE_WALLET_CLASS_SUFFIX || "lealtad");
  return `${credenciales().emisor}.${sufijo}`;
}

function idObjeto(numero: string) {
  return `${credenciales().emisor}.${limpiar(numero)}`;
}

function construirClase(datos: DatosPase, origen: string) {
  const logo = process.env.GOOGLE_WALLET_LOGO_URL || `${origen}/wallet/logo`;
  return {
    id: idClase(),
    issuerName: datos.negocio.nombre,
    programName: `Tarjeta de lealtad · ${datos.negocio.nombre}`,
    programLogo: {
      sourceUri: { uri: logo },
      contentDescription: {
        defaultValue: { language: "es-MX", value: `Logotipo de ${datos.negocio.nombre}` },
      },
    },
    hexBackgroundColor: process.env.GOOGLE_WALLET_COLOR || "#14100b",
    countryCode: "MX",
    reviewStatus: "UNDER_REVIEW",
    localizedIssuerName: {
      defaultValue: { language: "es-MX", value: datos.negocio.nombre },
    },
  };
}

function construirObjeto(datos: DatosPase, origen: string) {
  const faltan = datos.requerido - datos.progreso;
  const modulos = [
    {
      id: "proxima",
      header: "Próxima recompensa",
      body:
        datos.recompensasDisponibles > 0
          ? `Tienes ${datos.recompensasDisponibles} recompensa(s) de ${datos.descuento}% lista(s) para canjear.`
          : `Te ${faltan === 1 ? "falta 1 sello" : `faltan ${faltan} sellos`} para ${datos.descuento}% de descuento.`,
    },
    {
      id: "como",
      header: "Cómo funciona",
      body: `Cada visita suma un sello. Con ${datos.requerido} sellos ganas ${datos.descuento}% de descuento en tu siguiente servicio.`,
    },
  ];
  if (datos.negocio.direccion) {
    modulos.push({ id: "direccion", header: "Dirección", body: datos.negocio.direccion });
  }

  const enlaces: { uri: string; description: string; id: string }[] = [
    { id: "reservar", uri: `${origen}/reservar`, description: "Reservar cita" },
    { id: "tarjeta", uri: `${origen}/cuenta/tarjeta`, description: "Ver mi tarjeta" },
  ];
  if (datos.negocio.telefono) {
    enlaces.push({
      id: "llamar",
      uri: `tel:${datos.negocio.telefono.replace(/[^+\d]/g, "")}`,
      description: "Llamar",
    });
  }

  return {
    id: idObjeto(datos.numero),
    classId: idClase(),
    state: datos.estado === "activa" ? "ACTIVE" : "INACTIVE",
    accountId: datos.numero,
    accountName: datos.titular,
    loyaltyPoints: {
      label: "Sellos",
      balance: { string: `${datos.progreso}/${datos.requerido}` },
    },
    secondaryLoyaltyPoints: {
      label: "Recompensas",
      balance: { int: datos.recompensasDisponibles },
    },
    barcode: {
      type: "QR_CODE",
      value: datos.numero,
      alternateText: datos.numero,
    },
    textModulesData: modulos,
    linksModuleData: { uris: enlaces },
  };
}

/**
 * Enlace "Agregar a Google Wallet". `origen` es el dominio público de la app:
 * Google exige que el botón se pulse desde uno de los orígenes declarados.
 */
export function enlaceGuardar(datos: DatosPase, origen: string) {
  const { email, clave } = credenciales();
  const jwt = firmarJWT(
    {
      iss: email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [origen],
      payload: {
        loyaltyClasses: [construirClase(datos, origen)],
        loyaltyObjects: [construirObjeto(datos, origen)],
      },
    },
    clave!
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/**
 * Actualiza la tarjeta que el cliente ya tiene guardada. Devuelve `false` si
 * todavía no existe en Google (nunca la guardó): no es un error, el enlace de
 * guardado la creará ya con los datos al día.
 */
export async function actualizarPase(datos: DatosPase, origen: string): Promise<boolean> {
  const { email, clave } = credenciales();
  const token = await tokenDeCuentaDeServicio(email!, clave!, SCOPE);
  const objeto = construirObjeto(datos, origen);

  const res = await fetch(`${API}/loyaltyObject/${encodeURIComponent(objeto.id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(objeto),
    cache: "no-store",
  });

  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(`Google Wallet respondió ${res.status}: ${await res.text()}`);
  }
  return true;
}
