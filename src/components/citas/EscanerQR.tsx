"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, SwitchCamera } from "lucide-react";

type Detector = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Escáner de códigos QR con la cámara del dispositivo.
 *
 * Usa el BarcodeDetector nativo cuando el navegador lo trae (Chrome en
 * Android) y, si no, decodifica los cuadros con jsQR (Safari en iPhone). Un
 * mismo código no se reporta dos veces seguidas en pocos segundos, para que
 * dejar el teléfono frente a la cámara no confirme la cita varias veces.
 */
export function EscanerQR({ onLeer, pausado = false }: { onLeer: (texto: string) => void; pausado?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const ultimo = useRef<{ texto: string; t: number }>({ texto: "", t: 0 });
  const onLeerRef = useRef(onLeer);
  const pausadoRef = useRef(pausado);
  const [estado, setEstado] = useState<"iniciando" | "activo" | "error">("iniciando");
  const [error, setError] = useState("");
  const [frontal, setFrontal] = useState(false);
  const [intento, setIntento] = useState(0);

  onLeerRef.current = onLeer;
  pausadoRef.current = pausado;

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    let cancelado = false;
    let detector: Detector | null = null;
    let jsQR: typeof import("jsqr").default | null = null;
    let ocupado = false;

    async function arrancar() {
      setEstado("iniciando");
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("error");
        setError(
          window.isSecureContext
            ? "Este navegador no permite usar la cámara."
            : "La cámara sólo funciona en una conexión segura (https)."
        );
        return;
      }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: frontal ? "user" : { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (cancelado) return;
        const nombre = err instanceof DOMException ? err.name : "";
        setEstado("error");
        setError(
          nombre === "NotAllowedError"
            ? "El permiso de la cámara está bloqueado. Actívalo en los ajustes del navegador para este sitio y vuelve a intentar."
            : nombre === "NotFoundError"
              ? "No se encontró ninguna cámara en este dispositivo."
              : "No se pudo abrir la cámara. Ciérrala en otras apps y vuelve a intentar."
        );
        return;
      }
      if (cancelado) {
        flujo.getTracks().forEach((t) => t.stop());
        return;
      }

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (BD) {
        try {
          detector = new BD({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      if (!detector) jsQR = (await import("jsqr")).default;

      const v = video.current!;
      v.srcObject = flujo;
      v.setAttribute("playsinline", "true");
      await v.play().catch(() => undefined);
      if (cancelado) return;
      setEstado("activo");
      cuadro = requestAnimationFrame(leer);
    }

    async function leer() {
      if (cancelado) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !ocupado && !pausadoRef.current) {
        ocupado = true;
        try {
          let texto: string | null = null;
          if (detector) {
            const codigos = await detector.detect(v);
            texto = codigos[0]?.rawValue ?? null;
          } else if (jsQR && lienzo.current) {
            // Se reduce el cuadro: jsQR es más rápido y igual de certero a 640 px.
            const escala = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
            const w = Math.round(v.videoWidth * escala);
            const h = Math.round(v.videoHeight * escala);
            const c = lienzo.current;
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (ctx && w > 0 && h > 0) {
              ctx.drawImage(v, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              texto = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          }
          if (texto) {
            const ahora = Date.now();
            if (texto !== ultimo.current.texto || ahora - ultimo.current.t > 4000) {
              ultimo.current = { texto, t: ahora };
              navigator.vibrate?.(80);
              onLeerRef.current(texto);
            }
          }
        } catch {
          /* un cuadro ilegible no detiene el escáner */
        } finally {
          ocupado = false;
        }
      }
      cuadro = requestAnimationFrame(leer);
    }

    void arrancar();
    return () => {
      cancelado = true;
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [frontal, intento]);

  return (
    <div className={`escaner ${pausado ? "is-paused" : ""}`}>
      <video ref={video} muted playsInline aria-label="Vista de la cámara" className={frontal ? "is-mirror" : ""} />
      <canvas ref={lienzo} hidden />
      {estado === "activo" && (
        <div className="escaner-marco" aria-hidden>
          <span />
          <i />
        </div>
      )}
      {estado === "iniciando" && (
        <div className="escaner-aviso">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Abriendo la cámara…</p>
        </div>
      )}
      {estado === "error" && (
        <div className="escaner-aviso">
          <CameraOff className="h-7 w-7" />
          <p>{error}</p>
          <button type="button" className="btn-gold px-4 py-2 text-sm" onClick={() => setIntento((n) => n + 1)}>
            <Camera className="h-4 w-4" /> Reintentar
          </button>
        </div>
      )}
      {estado === "activo" && (
        <button
          type="button"
          className="escaner-girar"
          onClick={() => setFrontal((f) => !f)}
          aria-label="Cambiar de cámara"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
