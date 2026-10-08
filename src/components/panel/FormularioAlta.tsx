"use client";

import { useMemo, useState } from "react";
import {
  AtSign,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Home,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  X,
} from "lucide-react";
import type { Rol } from "@/lib/store";

// Alta de una cuenta en tres pasos: qué tipo de cuenta, quién es y un
// resumen antes de crearla. Cada campo dice para qué sirve y dónde se verá,
// para que quien da de alta no tenga que adivinar.

type Datos = {
  tipo: Rol;
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  especialidad: string;
  duracion_cita_min: number;
  acepta_domicilio: boolean;
  biografia: string;
};

export type AltaPeticion = {
  tipo: Rol;
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  barbero?: {
    especialidad: string;
    duracion_cita_min: number;
    acepta_domicilio: boolean;
    biografia: string;
  };
};

const TIPOS: Record<
  Rol,
  { titulo: string; icono: React.ReactNode; resumen: string; puede: string[] }
> = {
  cliente: {
    titulo: "Cliente",
    icono: <User />,
    resumen: "Alguien que se corta el pelo en la barbería.",
    puede: ["Reservar y ver sus citas", "Usar su tarjeta de lealtad y sus sellos", "Ver sus pagos y recompensas"],
  },
  barbero: {
    titulo: "Barbero",
    icono: <Scissors />,
    resumen: "Alguien del equipo que atiende clientes.",
    puede: ["Ver su agenda del día", "Configurar sus horarios", "Llevar fichas de sus clientes", "Aparecer al reservar en línea"],
  },
  admin: {
    titulo: "Administrador",
    icono: <ShieldCheck />,
    resumen: "Alguien que gestiona el negocio contigo.",
    puede: ["Ver todo el panel: caja, reportes y clientes", "Crear y eliminar clientes y barberos", "No puede crear ni eliminar administradores"],
  },
};

const vacio = (tipo: Rol): Datos => ({
  tipo,
  nombre: "",
  email: "",
  password: generarClave(),
  telefono: "",
  especialidad: "",
  duracion_cita_min: 30,
  acepta_domicilio: false,
  biografia: "",
});

/** Contraseña inicial fácil de dictar: sin letras que se confunden. */
function generarClave() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const n = () => letras[Math.floor(Math.random() * letras.length)];
  return `Cort${n()}${n()}${n()}${Math.floor(1000 + Math.random() * 9000)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Campo con etiqueta, explicación y error propios. */
function Campo({
  icono,
  etiqueta,
  ayuda,
  opcional,
  error,
  children,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  ayuda: React.ReactNode;
  opcional?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className={`alta-campo ${error ? "has-error" : ""}`}>
      <span className="alta-campo-etiqueta">
        {icono}
        {etiqueta}
        {opcional ? <em>Opcional</em> : <b aria-hidden>*</b>}
      </span>
      {children}
      <span className="alta-campo-ayuda">{error ?? ayuda}</span>
    </label>
  );
}

export function FormularioAlta({
  tipos,
  negocio,
  onCrear,
  onCerrar,
}: {
  /** Tipos de cuenta que esta sesión puede crear */
  tipos: Rol[];
  negocio: string;
  onCrear: (datos: AltaPeticion) => Promise<void>;
  onCerrar: () => void;
}) {
  const [d, setD] = useState<Datos>(() => vacio(tipos[0]));
  const [verClave, setVerClave] = useState(true);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<Datos | null>(null);
  const [copiado, setCopiado] = useState(false);

  const poner = <K extends keyof Datos>(k: K, v: Datos[K]) => setD((x) => ({ ...x, [k]: v }));

  const errores = useMemo(
    () => ({
      nombre: d.nombre.trim().length < 2 ? "Escribe nombre y apellido." : null,
      email: !EMAIL.test(d.email.trim()) ? "Escribe un correo válido, por ejemplo nombre@gmail.com." : null,
      password: d.password.length < 8 ? "Debe tener al menos 8 caracteres." : null,
      especialidad: d.tipo === "barbero" && !d.especialidad.trim() ? "Escribe en qué se especializa." : null,
    }),
    [d]
  );
  const valido = !Object.values(errores).some(Boolean);
  const mostrar = (k: keyof typeof errores) => (intento ? errores[k] : null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      await onCrear({
        tipo: d.tipo,
        nombre: d.nombre.trim(),
        email: d.email.trim().toLowerCase(),
        password: d.password,
        telefono: d.telefono.trim(),
        barbero:
          d.tipo === "barbero"
            ? {
                especialidad: d.especialidad.trim(),
                duracion_cita_min: d.duracion_cita_min,
                acepta_domicilio: d.acepta_domicilio,
                biografia: d.biografia.trim(),
              }
            : undefined,
      });
      setCreada(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setGuardando(false);
    }
  }

  // ── Cuenta creada: datos de acceso listos para compartir ───────────────
  if (creada) {
    const origen = typeof window !== "undefined" ? window.location.origin : "";
    const mensaje = `Hola ${creada.nombre.split(" ")[0]}, ya tienes tu cuenta en ${negocio}.\n\nEntra en: ${origen}/login\nCorreo: ${creada.email.trim().toLowerCase()}\nContraseña: ${creada.password}\n\nTe recomendamos cambiar la contraseña desde "¿Olvidaste tu contraseña?".`;
    const tel = creada.telefono.replace(/[^\d]/g, "");
    return (
      <section className="alta anim-pop">
        <div className="alta-exito">
          <CheckCircle2 className="alta-exito-icono" />
          <h2>Cuenta creada</h2>
          <p>
            <b>{creada.nombre}</b> ya puede entrar como <b>{TIPOS[creada.tipo].titulo.toLowerCase()}</b>. Mándale estos datos:
          </p>
          <pre className="alta-mensaje">{mensaje}</pre>
          <div className="alta-acciones">
            <button
              type="button"
              className="btn-gold px-5 py-2.5 text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(mensaje).catch(() => {});
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              }}
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar datos de acceso"}
            </button>
            <a
              className="alta-btn-sec"
              href={`https://wa.me/${tel.length === 10 ? `52${tel}` : tel}?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </a>
            <button
              type="button"
              className="alta-btn-sec"
              onClick={() => {
                setCreada(null);
                setIntento(false);
                setD(vacio(d.tipo));
              }}
            >
              <UserPlus className="h-4 w-4" /> Crear otra cuenta
            </button>
            <button type="button" className="alta-btn-sec" onClick={onCerrar}>
              Listo
            </button>
          </div>
        </div>
      </section>
    );
  }

  const info = TIPOS[d.tipo];

  return (
    <form onSubmit={enviar} className="alta anim-pop" noValidate>
      <header className="alta-head">
        <div>
          <p className="kicker">Dar de alta</p>
          <h2>Nueva cuenta</h2>
          <p>Llena los tres pasos. Los campos con <b>*</b> son obligatorios.</p>
        </div>
        <button type="button" className="alta-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X />
        </button>
      </header>

      {/* Paso 1 */}
      <section className="alta-paso">
        <h3>
          <span>1</span> ¿Qué tipo de cuenta es?
        </h3>
        <div className="alta-tipos" role="radiogroup" aria-label="Tipo de cuenta">
          {tipos.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={d.tipo === t}
              className={`alta-tipo ${d.tipo === t ? "is-active" : ""}`}
              onClick={() => poner("tipo", t)}
            >
              <span className="alta-tipo-icono">{TIPOS[t].icono}</span>
              <span className="alta-tipo-titulo">{TIPOS[t].titulo}</span>
              <span className="alta-tipo-resumen">{TIPOS[t].resumen}</span>
              <ul>
                {TIPOS[t].puede.map((p) => (
                  <li key={p}>
                    <Check /> {p}
                  </li>
                ))}
              </ul>
              {d.tipo === t && <span className="alta-tipo-check"><Check /></span>}
            </button>
          ))}
        </div>
      </section>

      <div className="alta-cuerpo">
        <div>
          {/* Paso 2 */}
          <section className="alta-paso">
            <h3>
              <span>2</span> Datos de la persona
            </h3>
            <div className="alta-grid">
              <Campo
                icono={<User />}
                etiqueta="Nombre completo"
                ayuda={
                  d.tipo === "barbero"
                    ? "Así aparece en el panel, en las citas y en la página pública al reservar."
                    : "Así aparece en el panel y en sus citas."
                }
                error={mostrar("nombre")}
              >
                <input value={d.nombre} onChange={(e) => poner("nombre", e.target.value)} placeholder="Ej. Juan Pérez" autoComplete="off" />
              </Campo>

              <Campo
                icono={<AtSign />}
                etiqueta="Correo electrónico"
                ayuda="Es su usuario para iniciar sesión. Usa un correo real: ahí le llega el código si olvida su contraseña."
                error={mostrar("email")}
              >
                <input type="email" value={d.email} onChange={(e) => poner("email", e.target.value)} placeholder="nombre@gmail.com" autoComplete="off" />
              </Campo>

              <Campo
                icono={<KeyRound />}
                etiqueta="Contraseña inicial"
                ayuda="Ya te sugerimos una. Al terminar te damos un mensaje con sus datos para enviárselo; después puede cambiarla."
                error={mostrar("password")}
              >
                <span className="alta-clave">
                  <input
                    type={verClave ? "text" : "password"}
                    value={d.password}
                    onChange={(e) => poner("password", e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar" : "Mostrar"}>
                    {verClave ? <EyeOff /> : <Eye />}
                  </button>
                  <button type="button" onClick={() => poner("password", generarClave())} aria-label="Generar otra">
                    <RefreshCw />
                  </button>
                </span>
              </Campo>

              <Campo
                icono={<Phone />}
                etiqueta="Teléfono / WhatsApp"
                ayuda="10 dígitos. Sirve para contactarle sobre sus citas y para mandarle sus datos de acceso por WhatsApp."
                opcional
              >
                <input type="tel" inputMode="numeric" value={d.telefono} onChange={(e) => poner("telefono", e.target.value)} placeholder="55 1234 5678" />
              </Campo>
            </div>
          </section>

          {d.tipo === "barbero" && (
            <section className="alta-paso">
              <h3>
                <span>2b</span> Su trabajo en la barbería
              </h3>
              <div className="alta-grid">
                <Campo
                  icono={<Sparkles />}
                  etiqueta="Especialidad"
                  ayuda="En qué es bueno. Se muestra bajo su nombre cuando el cliente elige barbero."
                  error={mostrar("especialidad")}
                >
                  <input value={d.especialidad} onChange={(e) => poner("especialidad", e.target.value)} placeholder="Ej. Fades y arreglo de barba" />
                </Campo>
                <Campo
                  icono={<Clock3 />}
                  etiqueta="Duración base de cita"
                  ayuda="Tiempo que se aparta en su agenda por cada reserva."
                >
                  <select value={d.duracion_cita_min} onChange={(e) => poner("duracion_cita_min", Number(e.target.value))}>
                    {[15, 20, 30, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} minutos
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo
                  icono={<Home />}
                  etiqueta="Servicio a domicilio"
                  ayuda="Actívalo si también va a casa del cliente; podrá elegirse al reservar."
                  opcional
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={d.acepta_domicilio}
                    className={`alta-switch ${d.acepta_domicilio ? "is-on" : ""}`}
                    onClick={() => poner("acepta_domicilio", !d.acepta_domicilio)}
                  >
                    <i />
                    {d.acepta_domicilio ? "Sí, atiende a domicilio" : "No, sólo en la barbería"}
                  </button>
                </Campo>
                <div className="alta-grid-full">
                  <Campo
                    icono={<IdCard />}
                    etiqueta="Biografía corta"
                    ayuda="Una o dos frases sobre él o ella. Aparece en la sección Equipo de la página pública."
                    opcional
                  >
                    <textarea rows={2} value={d.biografia} onChange={(e) => poner("biografia", e.target.value)} placeholder="Ej. 8 años de experiencia; experto en degradados y diseños." />
                  </Campo>
                </div>
              </div>
              <p className="alta-nota">
                <CalendarCheck />
                <span>
                  Sus días y horas de trabajo se configuran después en <b>Disponibilidad</b>.
                </span>
              </p>
            </section>
          )}
        </div>

        {/* Paso 3 */}
        <aside className="alta-paso alta-resumen">
          <h3>
            <span>3</span> Revisa y crea
          </h3>
          <div className="alta-resumen-card">
            <span className="alta-resumen-avatar">{d.nombre.trim().charAt(0).toUpperCase() || info.icono}</span>
            <p className="alta-resumen-nombre">{d.nombre.trim() || "Nombre de la persona"}</p>
            <span className="badge badge-gold">
              {info.icono} {info.titulo}
            </span>
            <dl>
              <div>
                <dt>Inicia sesión con</dt>
                <dd>{d.email.trim() || "—"}</dd>
              </div>
              <div>
                <dt>Contraseña</dt>
                <dd className="font-num">{d.password || "—"}</dd>
              </div>
              {d.tipo === "barbero" && (
                <div>
                  <dt>Citas de</dt>
                  <dd>{d.duracion_cita_min} min</dd>
                </div>
              )}
            </dl>
            <p className="alta-resumen-sub">
              <LayoutDashboard /> Entrará a {d.tipo === "cliente" ? "Mi cuenta" : d.tipo === "barbero" ? "su agenda" : "el panel de administración"}.
            </p>
          </div>

          {error && (
            <p className="alta-error" role="alert">
              {error}
            </p>
          )}
          {intento && !valido && <p className="alta-error">Revisa los campos marcados en rojo.</p>}

          <button type="submit" disabled={guardando} className="btn-gold w-full px-5 py-3 text-sm disabled:opacity-50">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Crear {info.titulo.toLowerCase()}
          </button>
          <p className="alta-resumen-sub">La cuenta queda lista al instante; no necesita confirmar su correo.</p>
        </aside>
      </div>
    </form>
  );
}
