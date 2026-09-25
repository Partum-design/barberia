"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, Clock3, Gift, Globe, Save, ShieldCheck } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { DIAS_SEMANA, useBarberia, type BarberiaConfig, type DiaSemana } from "@/lib/store";

const CAMPO =
  "w-full rounded-xl border border-slate-300/70 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-accent-500 dark:border-white/15";

// Nodo Administrador: datos del negocio (los mismos que publica la portada)
// y reglas del programa de lealtad.
export default function ConfiguracionAdminPage() {
  const store = useBarberia();
  const { listo, sesion, barberiaConfig, recompensasConfig } = store;

  const [barberia, setBarberia] = useState(barberiaConfig);
  const [recompensas, setRecompensas] = useState(recompensasConfig);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => setBarberia(barberiaConfig), [barberiaConfig]);
  useEffect(() => setRecompensas(recompensasConfig), [recompensasConfig]);

  if (!listo) return null;

  if (!sesion || sesion.rol !== "admin") {
    return <SinSesion />;
  }

  function guardar() {
    store.actualizarBarberiaConfig(barberia);
    store.actualizarRecompensasConfig(recompensas);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  const campo = (clave: keyof Omit<BarberiaConfig, "horario">) => ({
    value: barberia[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBarberia((c) => ({ ...c, [clave]: e.target.value })),
  });

  const cambiarDia = (dia: DiaSemana, cambios: Partial<BarberiaConfig["horario"][DiaSemana]>) =>
    setBarberia((c) => ({ ...c, horario: { ...c.horario, [dia]: { ...c.horario[dia], ...cambios } } }));

  return (
    <PanelShell sesion={sesion} activo="Configuración" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Ajustes</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Lo que escribas aquí es lo que ve tu clientela en la{" "}
          <Link href="/" className="font-medium text-accent-600 underline-offset-2 hover:underline">
            página de inicio
          </Link>
          . Los campos vacíos simplemente no se muestran.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="anim-in anim-d1 space-y-4 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4 text-accent-500" /> El negocio
          </h2>
          <Campo label="Nombre comercial">
            <input {...campo("nombre")} placeholder="Nombre de la barbería" className={CAMPO} />
          </Campo>
          <Campo label="Frase de portada">
            <input {...campo("eslogan")} placeholder="Una línea que resuma tu barbería" className={CAMPO} />
          </Campo>
          <Campo label="Quiénes somos">
            <textarea
              {...campo("descripcion")}
              rows={4}
              placeholder="Cuenta la historia del lugar, su estilo y lo que lo hace distinto."
              className={CAMPO}
            />
          </Campo>
          <Campo label="Año de apertura">
            <input {...campo("anio_fundacion")} inputMode="numeric" maxLength={4} placeholder="AAAA" className={CAMPO} />
          </Campo>
        </section>

        <section className="anim-in anim-d2 space-y-4 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Globe className="h-4 w-4 text-accent-500" /> Ubicación y contacto
          </h2>
          <Campo label="Dirección">
            <input {...campo("direccion")} placeholder="Calle, número, colonia, ciudad" className={CAMPO} />
          </Campo>
          <Campo label="Enlace de Google Maps">
            <input {...campo("mapa_url")} type="url" placeholder="https://maps.app.goo.gl/…" className={CAMPO} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Teléfono">
              <input {...campo("telefono")} type="tel" placeholder="+52 …" className={CAMPO} />
            </Campo>
            <Campo label="WhatsApp">
              <input {...campo("whatsapp")} type="tel" placeholder="+52 …" className={CAMPO} />
            </Campo>
          </div>
          <Campo label="Correo">
            <input {...campo("email")} type="email" placeholder="contacto@…" className={CAMPO} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Instagram">
              <input {...campo("instagram")} placeholder="@usuario" className={CAMPO} />
            </Campo>
            <Campo label="Facebook">
              <input {...campo("facebook")} placeholder="URL o página" className={CAMPO} />
            </Campo>
            <Campo label="TikTok">
              <input {...campo("tiktok")} placeholder="@usuario" className={CAMPO} />
            </Campo>
          </div>
        </section>

        <section className="anim-in anim-d3 space-y-3 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Clock3 className="h-4 w-4 text-accent-500" /> Horario de atención
          </h2>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Es el horario del local que se publica en la portada. La agenda de cada barbero se
            ajusta en su propio panel.
          </p>
          {DIAS_SEMANA.map((d) => {
            const bloque = barberia.horario[d.id];
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3">
                <label className="flex w-28 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bloque.activo}
                    onChange={(e) => cambiarDia(d.id, { activo: e.target.checked })}
                  />
                  {d.label}
                </label>
                {bloque.activo ? (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="time" value={bloque.inicio} onChange={(e) => cambiarDia(d.id, { inicio: e.target.value })} className="rounded-lg border border-slate-300/70 bg-transparent px-2 py-1 dark:border-white/15" />
                    <span style={{ color: "var(--ink-muted)" }}>a</span>
                    <input type="time" value={bloque.fin} onChange={(e) => cambiarDia(d.id, { fin: e.target.value })} className="rounded-lg border border-slate-300/70 bg-transparent px-2 py-1 dark:border-white/15" />
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Cerrado</span>
                )}
              </div>
            );
          })}
        </section>

        <section className="anim-in anim-d4 space-y-4 rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Gift className="h-4 w-4 text-accent-500" /> Programa de lealtad
          </h2>
          <Campo label="Sellos para ganar una recompensa">
            <input
              type="number"
              min={1}
              max={20}
              value={recompensas.citas_requeridas}
              onChange={(e) =>
                setRecompensas((r) => ({ ...r, citas_requeridas: Math.max(1, Number(e.target.value)) }))
              }
              className={CAMPO}
            />
          </Campo>
          <Campo label="Descuento otorgado (%)">
            <input
              type="number"
              min={1}
              max={100}
              value={recompensas.valor_descuento}
              onChange={(e) =>
                setRecompensas((r) => ({ ...r, valor_descuento: Math.max(1, Number(e.target.value)) }))
              }
              className={CAMPO}
            />
          </Campo>
          <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-100">
            Regla activa: cada <strong>{recompensas.citas_requeridas}</strong> sellos →{" "}
            <strong>{recompensas.valor_descuento}%</strong> de descuento. Cada cita asistida pone
            un sello automáticamente en la tarjeta del cliente.
          </p>
        </section>
      </div>

      <div className="anim-in anim-d5 mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={guardar}
          className="card-hover flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {guardado ? (
            <>
              <Check className="h-4 w-4" /> Guardado
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Guardar cambios
            </>
          )}
        </button>
      </div>
    </PanelShell>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldCheck className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión como administrador para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Iniciar sesión
      </Link>
    </main>
  );
}
