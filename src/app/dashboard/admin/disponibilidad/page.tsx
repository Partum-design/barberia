"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarX2, ShieldCheck, Store } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EditorHorario } from "@/components/panel/EditorHorario";
import { DIAS_SEMANA, useBarberia } from "@/lib/store";
import { horarioConPersonal, localTieneHorario, slotsDisponibles } from "@/lib/datos/disponibilidad";

// Nodo Administrador: disponibilidad de cada barbero y cobertura del local.
// Lo que se edita aquí es exactamente lo que alimenta la reserva en línea.
export default function DisponibilidadPage() {
  const store = useBarberia();
  const { listo, sesion, barberos, citas, barberiaConfig, horarioDeBarbero } = store;
  const [elegido, setElegido] = useState<string | null>(null);

  const cobertura = useMemo(
    () => horarioConPersonal(barberiaConfig, barberos, horarioDeBarbero),
    [barberiaConfig, barberos, horarioDeBarbero]
  );

  const libres = useMemo(
    () =>
      Object.fromEntries(
        barberos.map((b) => [
          b.id,
          slotsDisponibles({ barbero: b, horario: horarioDeBarbero(b.id), barberia: barberiaConfig, citas }),
        ])
      ),
    [barberos, citas, barberiaConfig, horarioDeBarbero]
  );

  if (!listo) return null;
  if (!sesion || sesion.rol !== "admin") return <SinSesion />;

  const barbero = barberos.find((b) => b.id === elegido) ?? barberos[0] ?? null;
  const conHorarioLocal = localTieneHorario(barberiaConfig);

  return (
    <PanelShell sesion={sesion} activo="Disponibilidad" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Agenda</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Disponibilidad</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Define cuándo atiende cada barbero. Los clientes sólo pueden reservar en horas con un
          barbero activo trabajando.
        </p>
      </header>

      {/* Cobertura: lo que ve el cliente en la portada y al reservar */}
      <section className="anim-in mb-6 rounded-3xl p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10" style={{ background: "var(--card)" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Store className="h-4 w-4 text-accent-500" /> Horario con personal
          </h2>
          <Link href="/dashboard/admin/configuracion" className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
            {conHorarioLocal ? "Horario del local configurado · editar →" : "Sin horario del local · configurarlo →"}
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-7">
          {DIAS_SEMANA.map((d) => {
            const b = cobertura[d.id];
            return (
              <li
                key={d.id}
                className={`rounded-2xl px-3 py-2 text-sm ring-1 ${b.activo ? "ring-accent-500/30" : "ring-slate-900/5 opacity-60 dark:ring-white/10"}`}
              >
                <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>{d.label}</span>
                <span className="font-medium">{b.activo ? `${b.inicio} – ${b.fin}` : "Sin personal"}</span>
              </li>
            );
          })}
        </ul>
        {conHorarioLocal && (
          <p className="mt-3 text-xs" style={{ color: "var(--ink-muted)" }}>
            Las horas de cada barbero se recortan al horario del local.
          </p>
        )}
      </section>

      {barberos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm dark:border-white/15" style={{ color: "var(--ink-muted)" }}>
          <CalendarX2 className="mx-auto mb-2 h-6 w-6" />
          Aún no hay barberos. Dalos de alta en{" "}
          <Link href="/dashboard/admin/equipo" className="font-medium underline">Equipo</Link>.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Barberos">
            {barberos.map((b) => {
              const n = libres[b.id]?.length ?? 0;
              return (
                <button
                  key={b.id}
                  role="tab"
                  aria-selected={b.id === barbero?.id}
                  onClick={() => setElegido(b.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    b.id === barbero?.id
                      ? "border-accent-500 bg-accent-100/50 text-accent-600 dark:bg-accent-500/10"
                      : "border-slate-200 dark:border-white/10"
                  } ${b.activo ? "" : "opacity-60"}`}
                >
                  {b.nombre}
                  <span className="ml-2 text-xs" style={{ color: "var(--ink-muted)" }}>
                    {b.activo ? `${n} libres` : "inactivo"}
                  </span>
                </button>
              );
            })}
          </div>

          {barbero && (
            <>
              <p className="mb-4 text-sm" style={{ color: "var(--ink-muted)" }}>
                {!barbero.activo
                  ? `${barbero.nombre} está inactivo: no aparece para reservar. Reactívalo en Equipo.`
                  : libres[barbero.id]?.length
                    ? `Próximo horario libre: ${format(libres[barbero.id][0], "EEEE d 'de' MMMM, HH:mm", { locale: es })}`
                    : `${barbero.nombre} no tiene horarios libres en los próximos 7 días.`}
              </p>
              <EditorHorario
                key={barbero.id}
                horario={horarioDeBarbero(barbero.id)}
                onCambio={(dia, cambios) => store.guardarHorarioDia(barbero.id, dia, cambios)}
                nota={`Disponibilidad de ${barbero.nombre}. También puede ajustarla desde su propio panel.`}
              />
            </>
          )}
        </>
      )}
    </PanelShell>
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
