"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  BellRing,
  CalendarCheck,
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  Gift,
  IdCard,
  Menu,
  MoreHorizontal,
  MoreVertical,
  PlusSquare,
  ScanLine,
  Share,
  Smartphone,
  Star,
  X,
  Zap,
} from "lucide-react";
import { alPedirInstalacion, plataformaDe, useInstalar, type Plataforma } from "@/lib/app-nativa";
import { useBarberia } from "@/lib/store";
import "./app.css";

const CLAVE_VISTO = "cortmart-app-visto";
const ESPERA_MS = 2200;
/** Pantallas donde estorbaría: acceso, enlaces de un solo uso y recursos. */
const RUTAS_SIN_INVITACION = ["/auth", "/restablecer", "/recuperar", "/wallet", "/confirmar", "/login"];
/** Duración de la salida (la entrada es más lenta y suave). */
const SALIDA_MS = 240;

type Beneficio = { icono: React.ReactNode; titulo: string; texto: string };

const PARA_CLIENTES: Beneficio[] = [
  { icono: <CalendarCheck />, titulo: "Agenda en dos toques", texto: "Barbero, servicio y hora sin llamar ni esperar." },
  { icono: <BellRing />, titulo: "Recordatorio de tu cita", texto: "Te avisamos el día de tu cita y si algo cambia." },
  { icono: <IdCard />, titulo: "Tu tarjeta siempre contigo", texto: "Tus sellos y el QR de llegada, a la mano." },
  { icono: <Gift />, titulo: "Promociones primero", texto: "Entérate antes que nadie de descuentos." },
];

const PARA_EQUIPO: Beneficio[] = [
  { icono: <BellRing />, titulo: "Avisos al instante", texto: "Cada reserva, cambio o cancelación en tu teléfono." },
  { icono: <CalendarClock />, titulo: "Tu agenda del día", texto: "Ábrela desde tu pantalla de inicio." },
  { icono: <ScanLine />, titulo: "Escanea y cobra rápido", texto: "Confirma llegadas con el QR y registra el pago." },
  { icono: <Zap />, titulo: "Más rápida", texto: "Pantalla completa, como una app normal." },
];

const leer = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: se vuelve a ofrecer en la siguiente visita */
  }
};

type Paso = { icono?: React.ReactNode; texto: React.ReactNode };

function pasosDe(p: Plataforma): { titulo: string; pasos: Paso[] } {
  switch (p) {
    case "ios-safari":
      return {
        titulo: "En tu iPhone (Safari)",
        pasos: [
          { icono: <Share />, texto: <>Toca <b>Compartir</b>, el cuadro con la flecha hacia arriba, en la barra de abajo.</> },
          { icono: <PlusSquare />, texto: <>Baja un poco y elige <b>«Agregar a inicio»</b>.</> },
          { icono: <Check />, texto: <>Toca <b>Agregar</b>. CortMart aparece en tu pantalla de inicio.</> },
        ],
      };
    case "ios-otro":
      return {
        titulo: "En tu iPhone",
        pasos: [
          { icono: <Share />, texto: <>Toca <b>Compartir</b> (cuadro con flecha) junto a la barra de direcciones, arriba.</> },
          { icono: <PlusSquare />, texto: <>Elige <b>«Agregar a inicio»</b>.</> },
          { icono: <Check />, texto: <>Toca <b>Agregar</b>. Si no aparece, abre esta página en <b>Safari</b>.</> },
        ],
      };
    case "android-samsung":
      return {
        titulo: "En tu Samsung",
        pasos: [
          { icono: <Menu />, texto: <>Toca el <b>menú</b> (las tres rayas) abajo a la derecha.</> },
          { icono: <PlusSquare />, texto: <>Elige <b>«Agregar página a»</b> y luego <b>«Pantalla de inicio»</b>.</> },
          { icono: <Check />, texto: <>Toca <b>Agregar</b>.</> },
        ],
      };
    case "android-firefox":
      return {
        titulo: "En Firefox",
        pasos: [
          { icono: <MoreVertical />, texto: <>Toca el <b>menú</b> (tres puntos).</> },
          { icono: <Download />, texto: <>Elige <b>«Instalar»</b> o <b>«Agregar a pantalla de inicio»</b>.</> },
          { icono: <Check />, texto: <>Confirma con <b>Agregar</b>.</> },
        ],
      };
    case "android-chrome":
      return {
        titulo: "En tu Android",
        pasos: [
          { icono: <MoreVertical />, texto: <>Toca el <b>menú</b> (tres puntos) arriba a la derecha.</> },
          { icono: <Download />, texto: <>Elige <b>«Instalar aplicación»</b> o <b>«Agregar a la pantalla principal»</b>.</> },
          { icono: <Check />, texto: <>Confirma con <b>Instalar</b>.</> },
        ],
      };
    case "en-app":
      return {
        titulo: "Primero ábrela en tu navegador",
        pasos: [
          { icono: <MoreHorizontal />, texto: <>Estás dentro de Facebook u otra app. Toca el <b>menú</b> (•••) arriba a la derecha.</> },
          { icono: <ExternalLink />, texto: <>Elige <b>«Abrir en el navegador»</b> (Chrome o Safari).</> },
          { icono: <Download />, texto: <>Ahí toca el ícono de <b>descargar</b> de CortMart para instalarla.</> },
        ],
      };
    default:
      return {
        titulo: "Instálala en tu teléfono",
        pasos: [
          { icono: <ScanLine />, texto: <>Escanea este código con la <b>cámara de tu teléfono</b>.</> },
          { icono: <Download />, texto: <>En la página que se abre, toca el ícono de <b>descargar</b>.</> },
        ],
      };
  }
}

/**
 * "Instala la app": aparece sola la primera vez que alguien entra desde su
 * teléfono y se vuelve a abrir cuando quiera con cualquier botón de
 * instalar (abrirInstalacion). En Android/Chrome instala con un toque; en
 * los demás muestra los pasos de su navegador. En el teléfono es una hoja
 * que sube desde abajo y se cierra arrastrándola hacia abajo.
 */
export function InvitacionApp() {
  const app = useInstalar();
  const { sesion } = useBarberia();
  const ruta = usePathname() ?? "/";
  const [montada, setMontada] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [vista, setVista] = useState<"inicio" | "pasos" | "lista">("inicio");
  const [plataforma, setPlataforma] = useState<Plataforma>("escritorio");
  const [instalando, setInstalando] = useState(false);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const hoja = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const previo = useRef<HTMLElement | null>(null);
  const arrastre = useRef<{ y: number; t: number; dy: number } | null>(null);

  useEffect(() => {
    setPlataforma(plataformaDe(navigator.userAgent, app.lista, app.ios));
  }, [app.lista, app.ios]);

  const abrir = useCallback(() => {
    previo.current = document.activeElement as HTMLElement | null;
    setVista("inicio");
    setMontada(true);
    // Un cuadro después: así la transición de entrada sí se ve.
    requestAnimationFrame(() => requestAnimationFrame(() => setAbierta(true)));
    guardar(CLAVE_VISTO, "1");
  }, []);

  const cerrar = useCallback(() => {
    setAbierta(false);
    window.setTimeout(() => {
      setMontada(false);
      previo.current?.focus?.();
    }, SALIDA_MS);
  }, []);

  // Cualquier botón "Instalar app" de la página la abre.
  useEffect(() => alPedirInstalacion(abrir), [abrir]);

  // Sola, sólo la primera vez y en el teléfono (o si se instala con un toque).
  const rutaPermitida = !RUTAS_SIN_INVITACION.some((r) => ruta.startsWith(r));
  useEffect(() => {
    if (app.instalada || !rutaPermitida || montada || leer(CLAVE_VISTO)) return;
    const telefono = window.matchMedia("(pointer: coarse)").matches;
    if (!telefono && !app.lista) return;
    const t = window.setTimeout(abrir, ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [app.instalada, app.lista, rutaPermitida, montada, abrir]);

  // Escape cierra; el foco entra a la ventana (sin anillo en el teléfono) y
  // no se escapa con Tab.
  useEffect(() => {
    if (!montada) return;
    hoja.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") return cerrar();
      if (e.key !== "Tab" || !hoja.current) return;
      const f = Array.from(hoja.current.querySelectorAll<HTMLElement>("button, a[href]")).filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    };
    window.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [montada, cerrar]);

  // Al cambiar de vista con el teclado, el foco sigue al botón principal.
  useEffect(() => {
    if (!montada || !hoja.current?.contains(document.activeElement) || document.activeElement === hoja.current) return;
    principal.current?.focus({ preventScroll: true });
  }, [vista, montada]);

  // QR para abrir la página en el teléfono (computadora o navegador interno).
  useEffect(() => {
    if (!montada || (plataforma !== "escritorio" && plataforma !== "en-app")) return;
    QRCode.toString(window.location.origin, { type: "svg", margin: 1, color: { dark: "#120802", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [montada, plataforma]);

  if (!montada) return null;

  async function instalar() {
    if (plataforma !== "directa") return setVista("pasos");
    setInstalando(true);
    const ok = await app.instalar();
    setInstalando(false);
    if (ok) setVista("lista");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el navegador no deja copiar: el QR y los pasos siguen ahí */
    }
  }

  // Arrastrar la hoja hacia abajo la cierra (con un tirón rápido basta).
  const alPresionar = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || arrastre.current) return;
    arrastre.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    hoja.current?.classList.add("is-arrastrando");
  };
  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a || !hoja.current) return;
    const dy = e.clientY - a.y;
    a.dy = dy;
    // Hacia arriba ofrece resistencia en vez de un tope seco.
    const y = dy > 0 ? dy : dy * 0.15;
    hoja.current.style.transform = `translateY(${y}px)`;
  };
  const alSoltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a || !hoja.current) return;
    hoja.current.classList.remove("is-arrastrando");
    const velocidad = Math.abs(a.dy) / Math.max(1, performance.now() - a.t);
    hoja.current.style.transform = "";
    if (a.dy > 110 || (a.dy > 20 && velocidad > 0.5)) cerrar();
  };

  const equipo = sesion?.rol === "admin" || sesion?.rol === "barbero";
  const beneficios = equipo ? PARA_EQUIPO : PARA_CLIENTES;
  const nombre = sesion?.nombre?.split(" ")[0];
  const guia = pasosDe(plataforma);
  const conQr = plataforma === "escritorio";

  return (
    <div className={`instalar-capa ${abierta ? "is-abierta" : ""}`}>
      <div className="instalar-fondo" onClick={cerrar} aria-hidden />
      <div ref={hoja} className="instalar-hoja" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo" tabIndex={-1}>
        <div className="instalar-agarre" onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
          <span className="instalar-asa" aria-hidden />
        </div>
        <button type="button" className="instalar-cerrar" onClick={cerrar} aria-label="Cerrar">
          <X aria-hidden />
        </button>

        <div className="instalar-ficha" onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
          <span className="instalar-icono">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/iconos/icono-192.png" alt="" width={72} height={72} />
          </span>
          <div className="min-w-0">
            <p className="instalar-nombre">CortMart</p>
            <p className="instalar-meta">
              <span>
                <Star aria-hidden /> 5.0
              </span>
              <span>Gratis</span>
              <span>Sin tienda de apps</span>
            </p>
          </div>
        </div>

        <div className="instalar-cuerpo" key={vista}>
          {vista === "inicio" && (
            <>
              <h2 id="instalar-titulo">{nombre ? `${nombre}, lleva CortMart en tu teléfono` : "Lleva CortMart en tu teléfono"}</h2>
              <ul className="instalar-beneficios">
                {beneficios.map((b, i) => (
                  <li key={b.titulo} style={{ animationDelay: `${60 + i * 45}ms` }}>
                    <span aria-hidden>{b.icono}</span>
                    <div>
                      <b>{b.titulo}</b>
                      <small>{b.texto}</small>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="instalar-acciones">
                <button ref={principal} type="button" className="instalar-principal" onClick={() => void instalar()} disabled={instalando}>
                  <Download aria-hidden /> {plataforma === "directa" ? "Instalar app" : plataforma === "escritorio" ? "Instalar en mi teléfono" : "Ver cómo instalarla"}
                </button>
                <button type="button" className="instalar-secundario" onClick={cerrar}>
                  Ahora no
                </button>
              </div>
              <p className="instalar-nota">Ocupa menos de 1 MB. Puedes volver a abrir esto con el ícono <Download aria-hidden className="inline" /> del menú.</p>
            </>
          )}

          {vista === "pasos" && (
            <>
              <h2 id="instalar-titulo">{guia.titulo}</h2>
              {conQr && qr && <div className="instalar-qr" role="img" aria-label="Código QR para abrir CortMart en tu teléfono" dangerouslySetInnerHTML={{ __html: qr }} />}
              <ol className="instalar-pasos">
                {guia.pasos.map((p, i) => (
                  <li key={i} style={{ animationDelay: `${40 + i * 60}ms` }}>
                    <span className="instalar-num" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="instalar-paso-icono" aria-hidden>
                      {p.icono}
                    </span>
                    <p>{p.texto}</p>
                  </li>
                ))}
              </ol>
              {plataforma === "en-app" && (
                <button type="button" className="instalar-secundario is-borde" onClick={() => void copiar()}>
                  {copiado ? <Check aria-hidden /> : <Copy aria-hidden />} {copiado ? "Enlace copiado" : "Copiar enlace para pegarlo en el navegador"}
                </button>
              )}
              <div className="instalar-acciones">
                <button ref={principal} type="button" className="instalar-principal" onClick={cerrar}>
                  <Check aria-hidden /> Entendido
                </button>
                <button type="button" className="instalar-secundario" onClick={() => setVista("inicio")}>
                  <ArrowLeft aria-hidden /> Volver
                </button>
              </div>
            </>
          )}

          {vista === "lista" && (
            <div className="instalar-lista" role="status">
              <span className="instalar-check">
                <Check aria-hidden />
              </span>
              <h2 id="instalar-titulo">¡Listo! Ya tienes CortMart</h2>
              <p>Búscala en tu pantalla de inicio con el ícono naranja.</p>
              <div className="instalar-acciones">
                <button ref={principal} type="button" className="instalar-principal" onClick={cerrar}>
                  <Smartphone aria-hidden /> Perfecto
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
