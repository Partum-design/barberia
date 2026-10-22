"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { useNotificaciones } from "@/lib/app-nativa";
import "./app.css";

type Aviso = { id: string; titulo: string; cuerpo: string; url: string; leida: boolean; creado_en: string };

const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
};

/** Campana con la bandeja de avisos: citas nuevas, cambios, cancelaciones y recordatorios. */
export function CampanaAvisos({ className = "" }: { className?: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const push = useNotificaciones();

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const d = (await res.json()) as { avisos: Aviso[]; sinLeer: number };
      setAvisos(d.avisos);
      setSinLeer(d.sinLeer);
    } catch {
      /* sin conexión: se intenta en la siguiente vuelta */
    }
  }, []);

  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => document.visibilityState === "visible" && void cargar(), 30_000);
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAbierta(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierta]);

  async function abrir() {
    const siguiente = !abierta;
    setAbierta(siguiente);
    if (siguiente && sinLeer > 0) {
      setSinLeer(0);
      await fetch("/api/notificaciones", { method: "POST", credentials: "same-origin" }).catch(() => {});
      setAvisos((l) => l.map((a) => ({ ...a, leida: true })));
    }
  }

  return (
    <div ref={raiz} className={`campana ${className}`}>
      <button
        type="button"
        className="campana-boton"
        onClick={() => void abrir()}
        aria-expanded={abierta}
        aria-label={sinLeer > 0 ? `Avisos: ${sinLeer} sin leer` : "Avisos"}
      >
        {sinLeer > 0 ? <BellRing className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
        {sinLeer > 0 && <span className="campana-punto">{sinLeer > 9 ? "9+" : sinLeer}</span>}
      </button>
      {abierta && (
        <div className="campana-panel anim-pop" role="dialog" aria-label="Avisos">
          <div className="campana-head">
            <b>Avisos</b>
            {push.estado === "apagado" && (
              <button type="button" className="campana-activar" onClick={() => void push.activar()}>
                <BellRing className="h-3.5 w-3.5" /> Recibir en este dispositivo
              </button>
            )}
            {push.estado === "activo" && (
              <span className="campana-estado">
                <CheckCheck className="h-3.5 w-3.5" /> Avisos activos
              </span>
            )}
          </div>
          {avisos.length === 0 ? (
            <p className="campana-vacia">Aquí verás tus citas nuevas, cambios, cancelaciones y recordatorios.</p>
          ) : (
            <ul>
              {avisos.map((a) => (
                <li key={a.id} className={a.leida ? "" : "is-nueva"}>
                  <Link href={a.url || "/"} onClick={() => setAbierta(false)}>
                    <b>{a.titulo}</b>
                    {a.cuerpo && <span>{a.cuerpo}</span>}
                    <small>{hace(a.creado_en)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
