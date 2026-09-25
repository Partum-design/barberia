"use client";

import { useRef, useState } from "react";
import { Check, CheckCircle2, RotateCcw, Scissors, ShieldCheck, Wifi } from "lucide-react";
import { AmexMark, MastercardMark, VisaMark } from "@/components/payments/BrandMarks";

export type MarcaTarjeta = "visa" | "mastercard" | "amex";

type SavedCardProps = {
  nombre?: string;
  toast?: boolean;
  trust?: boolean;
  brand?: MarcaTarjeta;
  last4?: string;
  vence?: string;
  active?: boolean;
  onSelect?: () => void;
};

/**
 * Tarjeta digital de pago con giro.
 *
 * Toda la maquetación interior se mide en unidades de contenedor (`cqw`, ver
 * `globals.css`), de modo que la pieza escala completa a cualquier ancho y
 * ninguna de las dos caras se recorta al girarla. Por eso aquí no hay tamaños
 * de texto en el marcado: el componente sólo aporta la estructura.
 */
export function SavedCard({
  nombre = "Mariana Gutiérrez",
  toast = true,
  trust = true,
  brand = "visa",
  last4 = "5521",
  vence = "09/29",
  active = false,
  onSelect,
}: SavedCardProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(px - 0.5) * 12}deg`);
    el.style.setProperty("--ry", `${(0.5 - py) * -10}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function resetTilt() {
    const el = sceneRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  const marcas: Record<MarcaTarjeta, React.ReactNode> = {
    visa: <VisaMark className="saved-card-mark" />,
    mastercard: <MastercardMark compact className="saved-card-mark" />,
    amex: <AmexMark className="saved-card-mark" />,
  };
  const cardMark = marcas[brand];

  return (
    <div className={`saved-card-wrap relative mx-auto w-full max-w-sm ${active ? "is-active" : ""}`}>
      <div className="saved-card-glow" aria-hidden />

      {toast && (
        <div className="anim-pop anim-d3 saved-card-toast" role="status">
          <CheckCircle2 /> Pago confirmado · horario asegurado
        </div>
      )}

      <div ref={sceneRef} onPointerMove={onMove} onPointerLeave={resetTilt} className="card-3d-scene relative z-10">
        <div className="card-3d">
          <div className={`saved-card-flipper ${flipped ? "is-flipped" : ""}`}>
            {/* Frente */}
            <div className="saved-card-face saved-card-front">
              <div className="card-shine pointer-events-none absolute inset-0" aria-hidden />
              <Scissors className="saved-card-watermark" strokeWidth={1.1} aria-hidden />

              <div className="saved-card-head">
                <p className="saved-card-brand">
                  HAIRCUT
                  <small>Barbershop</small>
                </p>
                <Wifi className="rotate-90" aria-hidden />
              </div>

              <div className="saved-card-chip" aria-hidden>
                <i />
                <i />
                <i />
              </div>

              <p className="saved-card-number">
                <span>••••</span>
                <span>••••</span>
                <span>••••</span>
                <span>{last4}</span>
              </p>

              <div className="saved-card-foot">
                <div>
                  <p className="saved-card-foot-label">Titular</p>
                  <p className="saved-card-foot-value">{nombre}</p>
                </div>
                <div className="saved-card-foot-right">
                  <div>
                    <p className="saved-card-foot-label">Vence</p>
                    <p className="saved-card-foot-value">{vence}</p>
                  </div>
                  {cardMark}
                </div>
              </div>
            </div>

            {/* Reverso */}
            <div className="saved-card-face saved-card-back">
              <div className="saved-card-strip" />
              <div className="saved-card-back-body">
                <p className="saved-card-foot-label">Firma autorizada</p>
                <div className="saved-card-signature">
                  <span>{nombre}</span>
                  <b>•••</b>
                </div>
              </div>
              <div className="saved-card-back-foot">
                <div className="min-w-0">
                  <p className="saved-card-foot-label">Método protegido</p>
                  <p>Tokenizado · datos cifrados de extremo a extremo</p>
                </div>
                {cardMark}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="saved-card-actions">
        {onSelect && (
          <button type="button" onClick={onSelect} className={active ? "is-selected" : ""} aria-pressed={active}>
            {active ? (
              <>
                <Check /> Activa
              </>
            ) : (
              "Usar esta tarjeta"
            )}
          </button>
        )}
        <button type="button" onClick={() => setFlipped((value) => !value)} aria-pressed={flipped}>
          <RotateCcw /> {flipped ? "Ver frente" : "Girar tarjeta"}
        </button>
      </div>

      {trust && (
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-white/55">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
          Método tokenizado; HAIRCUT no almacena el número completo.
        </p>
      )}
    </div>
  );
}
