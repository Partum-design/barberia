"use client";

import { useEffect, useState } from "react";
import { BellRing, Download, Smartphone, X } from "lucide-react";
import { abrirInstalacion, useInstalar, useNotificaciones } from "@/lib/app-nativa";
import "./app.css";

const CLAVE = "cortmart-tarjeta-app-oculta";

/**
 * Invitación a instalar la app y activar avisos. Se va sola cuando ya está
 * todo listo, y quien la cierra no la vuelve a ver en ese dispositivo.
 */
export function TarjetaApp({ rol }: { rol: "cliente" | "barbero" | "admin" }) {
  const app = useInstalar();
  const push = useNotificaciones();
  const [oculta, setOculta] = useState(true);

  useEffect(() => {
    try {
      setOculta(window.localStorage.getItem(CLAVE) === "1");
    } catch {
      setOculta(false);
    }
  }, []);

  const puedeInstalar = !app.instalada;
  const puedeAvisar = push.estado === "apagado";
  if (oculta || (!puedeInstalar && !puedeAvisar)) return null;

  const cerrar = () => {
    setOculta(true);
    try {
      window.localStorage.setItem(CLAVE, "1");
    } catch {
      /* sin almacenamiento: vuelve a aparecer la próxima vez */
    }
  };

  const texto =
    rol === "cliente"
      ? "Reserva en dos toques, ten tu QR a la mano y entérate al momento si tu cita cambia."
      : "Entérate al instante de cada reserva, cambio o cancelación, aunque no tengas el panel abierto.";

  return (
    <aside className="tarjeta-app anim-in" aria-label="App de la barbería">
      <span className="tarjeta-app-icono" aria-hidden>
        <Smartphone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tarjeta-app-titulo">Lleva CortMart en tu teléfono</p>
        <p className="tarjeta-app-texto">{texto}</p>
        {push.error && <p className="tarjeta-app-ios">{push.error}</p>}
        <div className="tarjeta-app-acciones">
          {puedeInstalar && (
            <button type="button" className="btn-gold is-sm" onClick={abrirInstalacion}>
              <Download className="h-4 w-4" /> Instalar app
            </button>
          )}
          {puedeAvisar && (
            <button type="button" className="btn-linea is-sm" onClick={() => void push.activar()}>
              <BellRing className="h-4 w-4" /> Activar notificaciones
            </button>
          )}
        </div>
      </div>
      <button type="button" className="tarjeta-app-cerrar" onClick={cerrar} aria-label="No volver a mostrar">
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
