"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Contrast, Link2, RotateCcw, Square, Type, Volume2, Wind, X } from "lucide-react";

// ============================================================================
// Herramientas de accesibilidad, pensadas sobre todo para clientes de la
// tercera edad: letra más grande, alto contraste, menos movimiento, enlaces
// subrayados y lectura en voz alta. Cada opción es un atributo `data-*` en
// <html> que globals.css interpreta; se recuerdan en este navegador y se
// aplican antes de pintar (ver SCRIPT_ACCESIBILIDAD en layout.tsx).
// ============================================================================

export const CLAVE_ACCESIBILIDAD = "barberia-accesibilidad";

type Preferencias = {
  texto: "normal" | "grande" | "muygrande";
  contraste: boolean;
  movimiento: boolean; // true = reducido
  enlaces: boolean;
};

const INICIALES: Preferencias = { texto: "normal", contraste: false, movimiento: false, enlaces: false };

/** Se inyecta en <head>: aplica lo guardado antes del primer pintado. */
export const SCRIPT_ACCESIBILIDAD = `try{var p=JSON.parse(localStorage.getItem("${CLAVE_ACCESIBILIDAD}")||"{}"),d=document.documentElement;if(p.texto&&p.texto!=="normal")d.dataset.texto=p.texto;if(p.contraste)d.dataset.contraste="alto";if(p.movimiento)d.dataset.movimiento="reducido";if(p.enlaces)d.dataset.enlaces="subrayados";}catch(e){}`;

function aplicar(p: Preferencias) {
  const d = document.documentElement;
  if (p.texto === "normal") delete d.dataset.texto;
  else d.dataset.texto = p.texto;
  if (p.contraste) d.dataset.contraste = "alto";
  else delete d.dataset.contraste;
  if (p.movimiento) d.dataset.movimiento = "reducido";
  else delete d.dataset.movimiento;
  if (p.enlaces) d.dataset.enlaces = "subrayados";
  else delete d.dataset.enlaces;
  window.dispatchEvent(new Event("barberia:accesibilidad"));
}

function leerGuardadas(): Preferencias {
  try {
    return { ...INICIALES, ...(JSON.parse(localStorage.getItem(CLAVE_ACCESIBILIDAD) ?? "{}") as Partial<Preferencias>) };
  } catch {
    return INICIALES;
  }
}

/** Texto a leer: lo seleccionado o, si no hay, el contenido principal. */
function textoParaLeer() {
  const seleccion = window.getSelection()?.toString().trim();
  if (seleccion) return seleccion;
  const principal = document.querySelector("main") ?? document.getElementById("contenido") ?? document.body;
  return (principal as HTMLElement).innerText.replace(/\s+\n/g, "\n").trim();
}

export function Accesibilidad() {
  const [abierto, setAbierto] = useState(false);
  const [prefs, setPrefs] = useState<Preferencias>(INICIALES);
  const [leyendo, setLeyendo] = useState(false);
  const [vozDisponible, setVozDisponible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPrefs(leerGuardadas());
    setVozDisponible("speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Escape cierra el panel y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  function cambiar(cambios: Partial<Preferencias>) {
    const nuevas = { ...prefs, ...cambios };
    setPrefs(nuevas);
    aplicar(nuevas);
    try {
      localStorage.setItem(CLAVE_ACCESIBILIDAD, JSON.stringify(nuevas));
    } catch {
      /* sin almacenamiento: la opción dura hasta recargar */
    }
  }

  function leer() {
    const voz = window.speechSynthesis;
    if (leyendo) {
      voz.cancel();
      setLeyendo(false);
      return;
    }
    const texto = textoParaLeer();
    if (!texto) return;
    voz.cancel();
    const frase = new SpeechSynthesisUtterance(texto.slice(0, 6000));
    frase.lang = "es-MX";
    frase.rate = 0.9;
    const espanol = voz.getVoices().find((v) => v.lang.startsWith("es"));
    if (espanol) frase.voice = espanol;
    frase.onend = () => setLeyendo(false);
    frase.onerror = () => setLeyendo(false);
    voz.speak(frase);
    setLeyendo(true);
  }

  const tamanos: { id: Preferencias["texto"]; label: string; muestra: string }[] = [
    { id: "normal", label: "Normal", muestra: "A" },
    { id: "grande", label: "Grande", muestra: "A" },
    { id: "muygrande", label: "Muy grande", muestra: "A" },
  ];

  const interruptores: { clave: "contraste" | "movimiento" | "enlaces"; label: string; ayuda: string; icono: React.ReactNode }[] = [
    { clave: "contraste", label: "Alto contraste", ayuda: "Letras más claras y bordes más visibles", icono: <Contrast /> },
    { clave: "movimiento", label: "Menos movimiento", ayuda: "Quita animaciones y efectos", icono: <Wind /> },
    { clave: "enlaces", label: "Subrayar enlaces", ayuda: "Para distinguir dónde se puede dar clic", icono: <Link2 /> },
  ];

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className="a11y-fab"
        aria-expanded={abierto}
        aria-controls="panel-accesibilidad"
        onClick={() => setAbierto((v) => !v)}
      >
        <Accessibility aria-hidden />
        <span>Accesibilidad</span>
      </button>

      {abierto && (
        <div
          ref={panelRef}
          id="panel-accesibilidad"
          role="dialog"
          aria-modal="false"
          aria-labelledby="titulo-accesibilidad"
          className="a11y-panel"
        >
          <div className="a11y-panel-head">
            <h2 id="titulo-accesibilidad">Accesibilidad</h2>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                botonRef.current?.focus();
              }}
              aria-label="Cerrar opciones de accesibilidad"
            >
              <X />
            </button>
          </div>

          <fieldset className="a11y-group">
            <legend>
              <Type aria-hidden /> Tamaño de la letra
            </legend>
            <div className="a11y-sizes">
              {tamanos.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={prefs.texto === t.id}
                  onClick={() => cambiar({ texto: t.id })}
                >
                  <span aria-hidden style={{ fontSize: `${1 + i * 0.3}rem` }}>{t.muestra}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="a11y-group">
            {interruptores.map((o) => (
              <button
                key={o.clave}
                type="button"
                role="switch"
                aria-checked={prefs[o.clave]}
                className="a11y-switch"
                onClick={() => cambiar({ [o.clave]: !prefs[o.clave] })}
              >
                <span className="a11y-switch-icon" aria-hidden>{o.icono}</span>
                <span className="a11y-switch-text">
                  <strong>{o.label}</strong>
                  <small>{o.ayuda}</small>
                </span>
                <span className="a11y-switch-state">{prefs[o.clave] ? "Activado" : "Apagado"}</span>
              </button>
            ))}
          </div>

          {vozDisponible && (
            <button type="button" className="a11y-read" onClick={leer} aria-pressed={leyendo}>
              {leyendo ? <Square aria-hidden /> : <Volume2 aria-hidden />}
              {leyendo ? "Detener lectura" : "Leer la página en voz alta"}
            </button>
          )}
          {vozDisponible && (
            <p className="a11y-hint">Consejo: selecciona un texto para que se lea sólo esa parte.</p>
          )}

          <button type="button" className="a11y-reset" onClick={() => cambiar(INICIALES)}>
            <RotateCcw aria-hidden /> Volver a como estaba
          </button>
        </div>
      )}
    </>
  );
}
