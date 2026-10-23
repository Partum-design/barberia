"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Parte del navegador de lib/antibot.ts: campo trampa, ficha firmada y,
// si hay llave, el recuadro de Cloudflare Turnstile.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Turnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

function cargarTurnstile(): Promise<Turnstile | null> {
  if (!SITE_KEY) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve(window.turnstile ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

export type DatosAntibot = { ficha?: string; trampa?: string; turnstile?: string };

export function useAntibot() {
  const [ficha, setFicha] = useState<string | undefined>();
  const [token, setToken] = useState<string | undefined>();
  const trampa = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  const pedirFicha = useCallback(() => {
    fetch("/api/antibot", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ficha?: string }) => setFicha(d.ficha))
      .catch(() => {});
  }, []);

  useEffect(() => {
    pedirFicha();
  }, [pedirFicha]);

  useEffect(() => {
    let vivo = true;
    void cargarTurnstile().then((t) => {
      if (!vivo || !t || !caja.current || widget.current) return;
      widget.current = t.render(caja.current, {
        sitekey: SITE_KEY,
        language: "es",
        callback: (v: string) => setToken(v),
        "expired-callback": () => setToken(undefined),
      });
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Lo que se manda con el formulario. */
  const datos = (): DatosAntibot => ({ ficha, trampa: trampa.current?.value || undefined, turnstile: token });

  /** Tras un rechazo: ficha y verificación nuevas. */
  const renovar = () => {
    pedirFicha();
    if (widget.current) window.turnstile?.reset(widget.current);
    setToken(undefined);
  };

  const campos = (
    <>
      {/* Trampa para bots: fuera de la vista y del teclado; una persona nunca la llena. */}
      <div className="antibot-trampa" aria-hidden="true">
        <label>
          No llenes este campo
          <input ref={trampa} type="text" name="sitio_web" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {SITE_KEY && <div ref={caja} className="antibot-turnstile" />}
    </>
  );

  return { campos, datos, renovar };
}
