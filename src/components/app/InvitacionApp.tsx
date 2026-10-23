"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  Download,
  Gift,
  IdCard,
  PlusSquare,
  ScanLine,
  Share,
  Smartphone,
  X,
  Zap,
} from "lucide-react";
import { useInstalar } from "@/lib/app-nativa";
import { useBarberia } from "@/lib/store";
import "./app.css";

const CLAVE = "cortmart-invitacion-app";
/** Quien dice «Ahora no» no la vuelve a ver en estos días. */
const DIAS_DE_PAUSA = 5;
const ESPERA_MS = 2500;
/** Pantallas donde estorbaría: acceso, enlaces de un solo uso y recursos. */
const RUTAS_SIN_INVITACION = ["/auth", "/restablecer", "/wallet", "/pwa", "/confirmar", "/login"];

type Beneficio = { icono: React.ReactNode; titulo: string; texto: string };

const PARA_CLIENTES: Beneficio[] = [
  { icono: <CalendarCheck />, titulo: "Agenda en dos toques", texto: "Elige servicio, barbero y hora sin llamar ni esperar." },
  { icono: <BellRing />, titulo: "Recordatorios de tu cita", texto: "Te avisamos el día de tu cita y si algo cambia." },
  { icono: <IdCard />, titulo: "Tu tarjeta siempre contigo", texto: "Tus sellos y el QR de tu cita, listos al llegar." },
  { icono: <Gift />, titulo: "Recompensas primero", texto: "Entérate antes que nadie de cortes gratis y promociones." },
];

const PARA_EQUIPO: Beneficio[] = [
  { icono: <BellRing />, titulo: "Avisos al instante", texto: "Cada reserva, cambio o cancelación te llega al teléfono." },
  { icono: <CalendarClock />, titulo: "Tu agenda del día", texto: "Ábrela desde tu pantalla de inicio, sin buscar la página." },
  { icono: <ScanLine />, titulo: "Escanea y cobra rápido", texto: "Confirma llegadas con el QR y registra el pago." },
  { icono: <Zap />, titulo: "Más rápida", texto: "Pantalla completa y carga al momento, como una app normal." },
];

function pausada() {
  try {
    const hasta = Number(window.localStorage.getItem(CLAVE) || 0);
    return hasta > Date.now();
  } catch {
    return false;
  }
}

function pausar(dias: number) {
  try {
    window.localStorage.setItem(CLAVE, String(Date.now() + dias * 86_400_000));
  } catch {
    /* sin almacenamiento: se vuelve a ofrecer en la siguiente visita */
  }
}

/**
 * Invitación a instalar la app que aparece unos segundos después de entrar.
 * En Android y computadora instala con un toque; en iPhone muestra los pasos
 * de «Agregar a inicio». No aparece si ya está instalada o si la cerraron hace
 * poco.
 */
export function InvitacionApp() {
  const app = useInstalar();
  const { sesion } = useBarberia();
  const ruta = usePathname() ?? "/";
  const [abierta, setAbierta] = useState(false);
  const [pasosIos, setPasosIos] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const disponible = !app.instalada && (app.lista || app.ios);
  const rutaPermitida = !RUTAS_SIN_INVITACION.some((r) => ruta.startsWith(r));

  useEffect(() => {
    if (!disponible || !rutaPermitida || abierta || pausada()) return;
    const t = window.setTimeout(() => setAbierta(true), ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [disponible, rutaPermitida, abierta]);

  useEffect(() => {
    if (!abierta) return;
    boton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [abierta, pasosIos]);

  if (!abierta || !disponible) return null;

  function cerrar() {
    pausar(DIAS_DE_PAUSA);
    setAbierta(false);
  }

  async function instalar() {
    if (!app.lista) return setPasosIos(true);
    setInstalando(true);
    const ok = await app.instalar();
    setInstalando(false);
    // Si la rechaza en el aviso del navegador, se le vuelve a ofrecer más adelante.
    pausar(ok ? 365 : DIAS_DE_PAUSA);
    setAbierta(false);
  }

  const equipo = sesion?.rol === "admin" || sesion?.rol === "barbero";
  const beneficios = equipo ? PARA_EQUIPO : PARA_CLIENTES;
  const nombre = sesion?.nombre?.split(" ")[0];

  return (
    <div className="invitacion-fondo" onClick={cerrar}>
      <div
        className="invitacion"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitacion-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="invitacion-asa" aria-hidden />
        <button type="button" className="invitacion-cerrar" onClick={cerrar} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>

        <div className="invitacion-cabeza">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/iconos/icono-192.png" alt="" width={64} height={64} className="invitacion-icono" />
          <div className="min-w-0">
            <p className="invitacion-kicker">
              <Smartphone className="h-3.5 w-3.5" /> App gratis · sin tienda
            </p>
            <h2 id="invitacion-titulo">
              {nombre ? `${nombre}, lleva CortMart en tu teléfono` : "Lleva CortMart en tu teléfono"}
            </h2>
          </div>
        </div>

        {!pasosIos ? (
          <>
            <ul className="invitacion-beneficios">
              {beneficios.map((b, i) => (
                <li key={b.titulo} style={{ animationDelay: `${120 + i * 70}ms` }}>
                  <span aria-hidden>{b.icono}</span>
                  <div>
                    <b>{b.titulo}</b>
                    <small>{b.texto}</small>
                  </div>
                </li>
              ))}
            </ul>
            <p className="invitacion-nota">Ocupa menos de 1 MB y no pide datos de tu tarjeta.</p>
            <div className="invitacion-acciones">
              <button ref={boton} type="button" className="invitacion-principal" onClick={() => void instalar()} disabled={instalando}>
                <Download className="h-5 w-5" /> {app.lista ? "Descargar app" : "Cómo instalarla"}
              </button>
              <button type="button" className="invitacion-secundario" onClick={cerrar}>
                Ahora no
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="invitacion-pasos">
              <li>
                <span aria-hidden>1</span>
                <p>
                  Toca <Share className="inline h-4 w-4" /> <b>Compartir</b> en la barra de Safari.
                </p>
              </li>
              <li>
                <span aria-hidden>2</span>
                <p>
                  Elige <PlusSquare className="inline h-4 w-4" /> <b>«Agregar a inicio»</b> y luego <b>Agregar</b>.
                </p>
              </li>
              <li>
                <span aria-hidden>3</span>
                <p>
                  Abre <b>CortMart</b> desde tu pantalla de inicio y activa los avisos.
                </p>
              </li>
            </ol>
            <div className="invitacion-acciones">
              <button
                ref={boton}
                type="button"
                className="invitacion-principal"
                onClick={() => {
                  pausar(30);
                  setAbierta(false);
                }}
              >
                Entendido
              </button>
              <button type="button" className="invitacion-secundario" onClick={() => setPasosIos(false)}>
                Volver
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
