"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Wand2 } from "lucide-react";
import { useBarberia, type Barbero, type Servicio } from "@/lib/store";
import "@/components/app/app.css";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Texto de cada casilla por barbero: "" = precio de lista. */
type Borrador = Record<string, Record<string, string>>;

const desdeBarbero = (b: Barbero, servicios: Servicio[]) =>
  Object.fromEntries(servicios.map((s) => [s.id, b.precios?.[s.id] !== undefined ? String(b.precios[s.id]) : ""]));

/**
 * Precios especiales por barbero. Se cambia de barbero con un toque y los
 * cambios de todos se guardan juntos. El ajuste rápido sube o baja todos los
 * servicios (o una categoría) en % o en pesos sobre el precio de lista.
 */
export function EditorPrecios({
  barberoInicial,
  onListo,
  onCancelar,
}: {
  barberoInicial?: string;
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const servicios = useMemo(() => store.servicios.filter((s) => s.activo), [store.servicios]);
  const equipo = useMemo(
    () => store.barberos.filter((b) => b.activo || b.id === barberoInicial),
    [store.barberos, barberoInicial]
  );
  const [actual, setActual] = useState(barberoInicial ?? equipo[0]?.id ?? "");
  const [borrador, setBorrador] = useState<Borrador>(() =>
    Object.fromEntries(equipo.map((b) => [b.id, desdeBarbero(b, servicios)]))
  );
  const [ajuste, setAjuste] = useState("");
  const [unidad, setUnidad] = useState<"%" | "$">("%");
  const [categoria, setCategoria] = useState<string>("todas");
  const [error, setError] = useState("");

  const categorias = [...new Set(servicios.map((s) => s.categoria))];
  const barbero = equipo.find((b) => b.id === actual);
  const casillas = borrador[actual] ?? {};

  const precioEn = (s: Servicio, texto: string | undefined) => {
    if (texto === undefined || texto.trim() === "") return s.precio;
    const n = Number(texto);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : s.precio;
  };

  // Barberos con cambios sin guardar.
  const pendientes = equipo.filter((b) => {
    const original = desdeBarbero(b, servicios);
    return servicios.some((s) => precioEn(s, original[s.id]) !== precioEn(s, borrador[b.id]?.[s.id]));
  });
  const especiales = (id: string) => servicios.filter((s) => precioEn(s, borrador[id]?.[s.id]) !== s.precio).length;

  const poner = (servicioId: string, valor: string) =>
    setBorrador((b) => ({ ...b, [actual]: { ...b[actual], [servicioId]: valor.replace(/[^\d]/g, "") } }));

  function aplicarAjuste() {
    const n = Number(ajuste.replace(",", "."));
    if (!Number.isFinite(n) || ajuste.trim() === "") return setError("Escribe cuánto subir o bajar, p. ej. 10 o -20.");
    setError("");
    setBorrador((b) => {
      const siguiente = { ...b[actual] };
      for (const s of servicios) {
        if (categoria !== "todas" && s.categoria !== categoria) continue;
        const bruto = unidad === "%" ? s.precio * (1 + n / 100) : s.precio + n;
        // Redondeo a múltiplos de 5 para que queden precios de mostrador.
        const p = Math.max(0, Math.round(bruto / 5) * 5);
        siguiente[s.id] = p === s.precio ? "" : String(p);
      }
      return { ...b, [actual]: siguiente };
    });
  }

  function restablecer() {
    setBorrador((b) => ({
      ...b,
      [actual]: Object.fromEntries(
        servicios.map((s) => [s.id, categoria === "todas" || s.categoria === categoria ? "" : (b[actual]?.[s.id] ?? "")])
      ),
    }));
  }

  function guardar() {
    let ok = 0;
    for (const b of pendientes) {
      const precios: Record<string, number> = {};
      // Se conservan precios de servicios en pausa que no se muestran aquí.
      for (const [id, v] of Object.entries(b.precios ?? {})) {
        if (!servicios.some((s) => s.id === id)) precios[id] = v;
      }
      for (const s of servicios) {
        const p = precioEn(s, borrador[b.id]?.[s.id]);
        if (p !== s.precio) precios[s.id] = p;
      }
      if (store.actualizarBarbero(b.id, { precios })) ok++;
    }
    if (ok === 0 && pendientes.length > 0) return setError("No se pudieron guardar los precios.");
    onListo(
      pendientes.length === 0
        ? "Sin cambios en los precios."
        : `Precios guardados para ${pendientes.map((b) => b.nombre.split(" ")[0]).join(", ")}.`
    );
  }

  if (equipo.length === 0) return <p className="text-sm">Primero da de alta a tu equipo.</p>;
  if (servicios.length === 0) return <p className="text-sm">Primero agrega servicios al catálogo.</p>;

  return (
    <div className="precios">
      <div className="precios-barberos" role="tablist" aria-label="Barbero">
        {equipo.map((b) => {
          const n = especiales(b.id);
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={b.id === actual}
              className="precios-barbero"
              onClick={() => setActual(b.id)}
            >
              <span className="precios-avatar" aria-hidden>
                {b.nombre.charAt(0)}
              </span>
              <span className="min-w-0">
                <b>{b.nombre.split(" ")[0]}</b>
                <small>{n === 0 ? "Precio de lista" : `${n} especial${n === 1 ? "" : "es"}`}</small>
              </span>
              {pendientes.some((x) => x.id === b.id) && <i className="precios-punto" title="Cambios sin guardar" />}
            </button>
          );
        })}
      </div>

      <div className="precios-rapido">
        <span className="precios-rapido-titulo">
          <Wand2 className="h-4 w-4" /> Ajuste rápido
        </span>
        <div className="precios-rapido-campos">
          <input
            className="campo-input"
            inputMode="decimal"
            placeholder="+10 o -20"
            value={ajuste}
            onChange={(e) => setAjuste(e.target.value.replace(/[^\d.,+-]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && aplicarAjuste()}
            aria-label="Cantidad del ajuste"
          />
          <div className="precios-unidad" role="group" aria-label="Unidad">
            {(["%", "$"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={unidad === u} onClick={() => setUnidad(u)}>
                {u}
              </button>
            ))}
          </div>
          <select className="campo-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="A qué servicios">
            <option value="todas">Todos los servicios</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                Sólo {c}
              </option>
            ))}
          </select>
          <button type="button" className="btn-gold px-4 py-2 text-sm" onClick={aplicarAjuste}>
            Aplicar
          </button>
          <button type="button" className="btn-linea px-3 py-2 text-sm" onClick={restablecer} title="Volver al precio de lista">
            <RotateCcw className="h-4 w-4" /> Lista
          </button>
        </div>
        <small>Sobre el precio de lista, redondeado a $5. Luego puedes ajustar cada uno a mano.</small>
      </div>

      {categorias.map((cat) => (
        <section key={cat} className="precios-grupo">
          <h3>{cat}</h3>
          {servicios
            .filter((s) => s.categoria === cat)
            .map((s) => {
              const texto = casillas[s.id] ?? "";
              const p = precioEn(s, texto);
              const dif = p - s.precio;
              return (
                <label key={s.id} className={`precio-fila ${dif !== 0 ? "is-especial" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <b>{s.nombre}</b>
                    <small>Lista {mxn.format(s.precio)}</small>
                  </span>
                  {dif !== 0 && (
                    <span className={`precio-dif ${dif > 0 ? "is-mas" : "is-menos"}`}>
                      {dif > 0 ? "+" : "−"}
                      {mxn.format(Math.abs(dif))}
                    </span>
                  )}
                  <span className="precio-input">
                    <span aria-hidden>$</span>
                    <input
                      inputMode="numeric"
                      value={texto}
                      placeholder={String(s.precio)}
                      onChange={(e) => poner(s.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      aria-label={`Precio de ${s.nombre} con ${barbero?.nombre ?? "el barbero"}`}
                    />
                  </span>
                </label>
              );
            })}
        </section>
      ))}

      {error && (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      )}

      <div className="form-acciones precios-acciones">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn-gold px-5 py-2.5 text-sm" onClick={guardar}>
          <Check className="h-4 w-4" />{" "}
          {pendientes.length > 1 ? `Guardar (${pendientes.length} barberos)` : "Guardar precios"}
        </button>
      </div>
    </div>
  );
}
