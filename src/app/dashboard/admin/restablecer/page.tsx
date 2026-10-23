"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  Copy,
  History,
  KeyRound,
  Loader2,
  Lock,
  MessageCircle,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EmptyState, ModulePanel, SinAcceso } from "@/components/panel/ModuleUI";
import { useBarberia } from "@/lib/store";

type Solicitud = { id: string; cliente_id: string; creada_en: string; nombre: string; telefono: string };
type Ficha = {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  cuenta: "con_clave" | "sin_clave" | "google";
  clave_cambiada_en: string | null;
  acceso_reiniciado_en: string | null;
  ultimo_acceso: string | null;
};
type Movimiento = { accion: string; actor_nombre: string | null; creada_en: string };
type Enlace = { enlace: string; expira_en: string; nombre: string; telefono: string };

const ESTADO_CUENTA: Record<Ficha["cuenta"], string> = {
  con_clave: "Tiene contraseña",
  sin_clave: "Aún sin contraseña (registrado en barbería o reservó con su número)",
  google: "Entra con Google (sin contraseña)",
};
const ACCION: Record<string, string> = {
  generar_enlace: "Generó un enlace de restablecimiento",
  reiniciar_acceso: "Reinició el acceso",
};

const bonito = (t: string) => (t.length === 10 ? `${t.slice(0, 2)} ${t.slice(2, 6)} ${t.slice(6)}` : t || "sin celular");
const fecha = (iso: string) => format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });

async function llamar<T>(query = "", body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/restablecer${query}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const cuerpo = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(cuerpo.error ?? "No se pudo completar la acción.");
  return cuerpo;
}

/**
 * Restablecer contraseñas: atiende a los clientes que sólo tienen celular.
 * La barbería genera un enlace de un solo uso (30 min) y lo manda por
 * WhatsApp, lo copia o lo muestra en QR para que el cliente lo escanee.
 */
export default function RestablecerAdminPage() {
  const store = useBarberia();
  const { listo, sesion } = store;
  const esAdmin = sesion?.rol === "admin";
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Ficha[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [bitacora, setBitacora] = useState<Movimiento[]>([]);
  const [enlace, setEnlace] = useState<Enlace | null>(null);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState<null | "generar" | "reiniciar" | "abrir">(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await llamar<{ solicitudes: Solicitud[] }>();
      setSolicitudes(r.solicitudes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las solicitudes.");
      setSolicitudes([]);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) void cargar();
  }, [esAdmin, cargar]);

  // Búsqueda mientras escribe (con una pausa corta para no saturar).
  useEffect(() => {
    if (!esAdmin) return;
    const q = busqueda.trim();
    if (q.length < 2) {
      setResultados(null);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      llamar<{ clientes: Ficha[] }>(`?q=${encodeURIComponent(q)}`)
        .then((r) => setResultados(r.clientes))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, esAdmin]);

  useEffect(() => {
    if (!enlace) return setQr("");
    QRCode.toString(enlace.enlace, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#120802", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [enlace]);

  async function abrir(clienteId: string) {
    setError(null);
    setAviso(null);
    setEnlace(null);
    setOcupado("abrir");
    try {
      const r = await llamar<{ cliente: Ficha; bitacora: Movimiento[] }>(`?cliente=${encodeURIComponent(clienteId)}`);
      setFicha(r.cliente);
      setBitacora(r.bitacora);
      setTimeout(() => document.getElementById("detalle-cliente")?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el cliente.");
    } finally {
      setOcupado(null);
    }
  }

  async function generar() {
    if (!ficha) return;
    setError(null);
    setAviso(null);
    setOcupado("generar");
    try {
      const r = await llamar<Enlace>("", { accion: "generar", clienteId: ficha.id });
      setEnlace(r);
      setCopiado(false);
      await Promise.all([cargar(), abrir(ficha.id).then(() => setEnlace(r))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el enlace.");
    } finally {
      setOcupado(null);
    }
  }

  async function reiniciar() {
    if (!ficha) return;
    if (
      !window.confirm(
        `¿Reiniciar el acceso de ${ficha.nombre}? Se cerrarán todas sus sesiones y su contraseña actual dejará de servir. Después genérale un enlace para que cree una nueva.`
      )
    )
      return;
    setError(null);
    setOcupado("reiniciar");
    try {
      await llamar("", { accion: "reiniciar", clienteId: ficha.id });
      setEnlace(null);
      await abrir(ficha.id);
      setAviso(`Se reinició el acceso de ${ficha.nombre}. Ahora genérale un enlace.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reiniciar el acceso.");
    } finally {
      setOcupado(null);
    }
  }

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace.enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copia el enlace:", enlace.enlace);
    }
  }

  if (!listo) return null;
  if (!sesion || !esAdmin) return <SinAcceso mensaje="Inicia sesión como administrador para ver este módulo" />;

  const whatsapp = enlace
    ? `https://wa.me/52${enlace.telefono}?text=${encodeURIComponent(
        `Hola ${enlace.nombre.split(" ")[0]}, este es tu enlace para crear una nueva contraseña en CortMart (válido 30 min): ${enlace.enlace}`
      )}`
    : "";

  return (
    <PanelShell sesion={sesion} activo="Restablecer contraseñas" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Accesos</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Restablecer contraseñas</h1>
        <p className="mt-1 max-w-3xl text-base" style={{ color: "var(--ink-muted)" }}>
          Para clientes que sólo tienen celular. Genera un enlace de un solo uso (dura 30 minutos) y mándalo por WhatsApp o
          muéstrale el QR en la barbería.
        </p>
      </header>

      <p className="restablecer-aviso" role="note">
        <ShieldAlert aria-hidden />
        <span>
          <b>Verifica que es el cliente</b> (en persona o desde su mismo número de WhatsApp) antes de enviar el enlace.
        </span>
      </p>

      {error && (
        <p className="mb-4 rounded-xl px-4 py-3 text-base ring-1 ring-red-500/30" style={{ color: "#f0a59c" }} role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-xl px-4 py-3 text-base ring-1 ring-emerald-500/30" role="status">
          {aviso}
        </p>
      )}

      <div className="restablecer-grid">
        <div className="space-y-6">
          <ModulePanel titulo={`Solicitudes pendientes${solicitudes?.length ? ` (${solicitudes.length})` : ""}`}>
            {solicitudes === null ? (
              <p className="flex items-center gap-2 text-base" style={{ color: "var(--ink-muted)" }}>
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            ) : solicitudes.length === 0 ? (
              <EmptyState icono={<KeyRound />}>No hay solicitudes pendientes.</EmptyState>
            ) : (
              <ul className="restablecer-lista">
                {solicitudes.map((s) => (
                  <li key={s.id}>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{s.nombre}</b>
                      <span className="restablecer-meta">
                        {bonito(s.telefono)} · pidió ayuda {formatDistanceToNow(new Date(s.creada_en), { locale: es, addSuffix: true })}
                      </span>
                    </span>
                    <button type="button" className="btn-gold restablecer-boton" onClick={() => abrir(s.cliente_id)}>
                      Atender
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="restablecer-meta mt-3">Las solicitudes sin atender vencen a los 7 días.</p>
          </ModulePanel>

          <ModulePanel titulo="Buscar cliente">
            <label htmlFor="buscar-cliente" className="restablecer-label">
              Nombre o celular (si te pide ayuda en persona o por WhatsApp)
            </label>
            <div className="restablecer-buscar">
              <Search aria-hidden />
              <input
                id="buscar-cliente"
                name="buscar-cliente"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej. Juan o 5512345678"
                autoComplete="off"
              />
              {buscando && <Loader2 className="h-4 w-4 animate-spin" aria-label="Buscando" />}
            </div>
            {resultados && resultados.length === 0 && !buscando && (
              <p className="restablecer-meta mt-3">No encontramos clientes con ese nombre o número.</p>
            )}
            {resultados && resultados.length > 0 && (
              <ul className="restablecer-lista mt-3">
                {resultados.map((c) => (
                  <li key={c.id}>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{c.nombre}</b>
                      <span className="restablecer-meta">
                        {bonito(c.telefono)} · {c.cuenta === "con_clave" ? "con contraseña" : c.cuenta === "google" ? "Google" : "sin contraseña"}
                      </span>
                    </span>
                    <button type="button" className="restablecer-boton is-ghost" onClick={() => abrir(c.id)}>
                      Elegir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ModulePanel>
        </div>

        <ModulePanel titulo="Cliente">
          {!ficha ? (
            <EmptyState icono={<UserRound />}>Elige una solicitud o busca un cliente.</EmptyState>
          ) : (
            <div id="detalle-cliente" tabIndex={-1} className="restablecer-detalle outline-none">
              <h2 className="text-xl font-semibold">{ficha.nombre}</h2>
              <dl className="restablecer-datos">
                <div>
                  <dt>Celular</dt>
                  <dd>{bonito(ficha.telefono)}</dd>
                </div>
                {ficha.correo && (
                  <div>
                    <dt>Correo</dt>
                    <dd>{ficha.correo} (puede recuperarla sola en /recuperar)</dd>
                  </div>
                )}
                <div>
                  <dt>Estado de la cuenta</dt>
                  <dd>{ESTADO_CUENTA[ficha.cuenta]}</dd>
                </div>
                <div>
                  <dt>Último cambio de contraseña</dt>
                  <dd>{ficha.clave_cambiada_en ? fecha(ficha.clave_cambiada_en) : "sin registro"}</dd>
                </div>
                <div>
                  <dt>Último acceso</dt>
                  <dd>{ficha.ultimo_acceso ? fecha(ficha.ultimo_acceso) : "nunca ha entrado"}</dd>
                </div>
                {ficha.acceso_reiniciado_en && (
                  <div>
                    <dt>Acceso reiniciado</dt>
                    <dd>{fecha(ficha.acceso_reiniciado_en)}</dd>
                  </div>
                )}
              </dl>

              <div className="restablecer-acciones">
                <button type="button" className="btn-gold restablecer-boton" onClick={generar} disabled={ocupado !== null}>
                  {ocupado === "generar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  Generar enlace de restablecimiento
                </button>
                {ficha.cuenta === "con_clave" && (
                  <button type="button" className="restablecer-boton is-ghost" onClick={reiniciar} disabled={ocupado !== null}>
                    {ocupado === "reiniciar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" aria-hidden />}
                    Reiniciar acceso
                  </button>
                )}
              </div>
              {ficha.cuenta === "con_clave" && (
                <p className="restablecer-meta">
                  <AlertTriangle className="inline h-4 w-4" aria-hidden /> «Reiniciar acceso» sirve si alguien más entró con el número
                  del cliente: cierra todas sus sesiones y anula su contraseña.
                </p>
              )}

              {enlace && (
                <div className="restablecer-enlace" role="status">
                  <p className="font-semibold">Enlace listo · vence a las {format(new Date(enlace.expira_en), "HH:mm")}</p>
                  <input readOnly value={enlace.enlace} aria-label="Enlace de restablecimiento" onFocus={(e) => e.currentTarget.select()} />
                  <div className="restablecer-acciones">
                    <button type="button" className="restablecer-boton is-ghost" onClick={copiar}>
                      {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                      {copiado ? "Copiado" : "Copiar"}
                    </button>
                    {enlace.telefono.length === 10 && (
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-gold restablecer-boton">
                        <MessageCircle className="h-4 w-4" aria-hidden /> Enviar por WhatsApp
                      </a>
                    )}
                  </div>
                  {qr && (
                    <figure className="restablecer-qr">
                      <div role="img" aria-label="Código QR del enlace" dangerouslySetInnerHTML={{ __html: qr }} />
                      <figcaption>El cliente lo escanea con la cámara de su celular.</figcaption>
                    </figure>
                  )}
                </div>
              )}

              {bitacora.length > 0 && (
                <div className="mt-6">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <History className="h-4 w-4" aria-hidden /> Bitácora
                  </h3>
                  <ul className="restablecer-bitacora">
                    {bitacora.map((m, i) => (
                      <li key={i}>
                        {ACCION[m.accion] ?? m.accion} · <b>{m.actor_nombre ?? "Sistema"}</b> · {fecha(m.creada_en)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ModulePanel>
      </div>
    </PanelShell>
  );
}
