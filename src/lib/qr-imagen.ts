import QRCode from "qrcode";

// ============================================================================
// QR como imagen para guardar en el teléfono. Google Wallet necesita llaves
// de emisor para firmar cada pase; una foto en la galería no, y en mostrador
// se escanea igual. En el teléfono abre el menú de compartir (Guardar en
// Fotos, WhatsApp…); en computadora descarga el PNG.
// ============================================================================

export type DatosImagenQr = {
  /** Lo que lleva el QR (enlace de la cita o número de tarjeta) */
  contenido: string;
  /** Encabezado: nombre del negocio */
  titulo: string;
  /** Qué es: "Tarjeta de lealtad", "Cita", … */
  subtitulo: string;
  /** Código legible bajo el QR, para dictarlo si la cámara falla */
  codigo: string;
  /** Renglones extra: titular, fecha, barbero… */
  detalles?: string[];
  /** Nombre del archivo sin extensión */
  archivo: string;
};

const ANCHO = 1080;
const ALTO = 1440;
const NARANJA = "#f7931e";

async function dibujar(d: DatosImagenQr): Promise<Blob> {
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no puede generar la imagen.");

  ctx.fillStyle = "#0c0806";
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.strokeStyle = NARANJA;
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, ANCHO - 72, ALTO - 72);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f6eee4";
  ctx.font = "bold 76px system-ui, sans-serif";
  ctx.fillText(d.titulo.toUpperCase(), ANCHO / 2, 170, ANCHO - 140);
  ctx.fillStyle = NARANJA;
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(d.subtitulo.toUpperCase(), ANCHO / 2, 235, ANCHO - 140);

  const lado = 680;
  const x = (ANCHO - lado) / 2;
  const y = 300;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 30, y - 30, lado + 60, lado + 60);
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, d.contenido, {
    width: lado,
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#120802", light: "#ffffff" },
  });
  ctx.drawImage(qr, x, y, lado, lado);

  ctx.fillStyle = "rgba(246, 238, 228, 0.7)";
  ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillText("CÓDIGO", ANCHO / 2, y + lado + 110);
  ctx.fillStyle = "#f6eee4";
  ctx.font = "bold 72px ui-monospace, monospace";
  ctx.fillText(d.codigo, ANCHO / 2, y + lado + 190, ANCHO - 140);

  ctx.fillStyle = "rgba(246, 238, 228, 0.85)";
  ctx.font = "500 38px system-ui, sans-serif";
  (d.detalles ?? []).slice(0, 3).forEach((linea, i) => {
    ctx.fillText(linea, ANCHO / 2, y + lado + 265 + i * 52, ANCHO - 140);
  });

  return new Promise((resolve, reject) =>
    lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen."))), "image/png")
  );
}

/** Genera la imagen y la comparte (teléfono) o la descarga (computadora). */
export async function guardarQrComoImagen(d: DatosImagenQr) {
  const blob = await dibujar(d);
  const nombre = `${d.archivo.replace(/[^\w-]+/g, "-")}.png`;
  const archivo = new File([blob], nombre, { type: "image/png" });

  const tactil = window.matchMedia("(pointer: coarse)").matches;
  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: `${d.titulo} · ${d.subtitulo}` });
      return;
    } catch (err) {
      // Cerrar el menú de compartir no es un error; cualquier otra cosa cae a la descarga.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
