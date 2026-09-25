"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Scissors,
  ShieldCheck,
  User,
} from "lucide-react";
import { GoogleMark } from "@/components/payments/BrandMarks";
import { authDisponible, getSupabaseBrowser } from "@/lib/supabase/client";
import { DESTINO_POR_ROL } from "@/lib/auth/roles";
import { SESION_ADMIN_LOCAL, useBarberia, type Rol, type Sesion } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";

type Modo = "entrar" | "crear" | "enlace";

const SIN_SUPABASE =
  "El acceso con Google y correo se activa al conectar Supabase. Mientras tanto usa el acceso local de abajo.";

const TEXTOS: Record<Modo, { titulo: string; lead: string; accion: string }> = {
  entrar: {
    titulo: "Iniciar sesión",
    lead: "Entra con Google o con tu correo para continuar donde lo dejaste.",
    accion: "Entrar",
  },
  crear: {
    titulo: "Crear cuenta",
    lead: "Reserva en segundos y guarda tus preferencias de corte y tus métodos de pago.",
    accion: "Crear cuenta",
  },
  enlace: {
    titulo: "Entrar sin contraseña",
    lead: "Te enviamos un enlace de un solo uso a tu correo. Sin contraseñas que recordar.",
    accion: "Enviar enlace",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <Acceso />
    </Suspense>
  );
}

function Acceso() {
  const router = useRouter();
  const params = useSearchParams();
  const { entrarLocal, barberos, clientes, registrarCliente, listo } = useBarberia();

  const siguiente = params.get("next");
  const [modo, setModo] = useState<Modo>("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState<null | "google" | "correo">(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [aviso, setAviso] = useState<string | null>(null);

  const texto = TEXTOS[modo];

  /** Destino tras autenticarse: respeta el `next` que puso el middleware. */
  const destino = (rol: Rol) =>
    siguiente && siguiente.startsWith("/") ? siguiente : DESTINO_POR_ROL[rol];

  async function entrarConGoogle() {
    setError(null);
    setAviso(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError(SIN_SUPABASE);
      return;
    }
    setCargando("google");
    const retorno = new URL("/auth/callback", window.location.origin);
    if (siguiente) retorno.searchParams.set("next", siguiente);

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: retorno.toString(),
        // `consent` fuerza a Google a devolver refresh token la primera vez;
        // sin él, una segunda autorización vuelve sin él y la sesión no se
        // puede renovar en segundo plano.
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (err) {
      setCargando(null);
      setError(err.message);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError(SIN_SUPABASE);
      return;
    }

    setCargando("correo");
    try {
      if (modo === "enlace") {
        const retorno = new URL("/auth/callback", window.location.origin);
        if (siguiente) retorno.searchParams.set("next", siguiente);
        const { error: err } = await supabase.auth.signInWithOtp({
          email: correo,
          options: { emailRedirectTo: retorno.toString() },
        });
        if (err) throw err;
        setAviso(`Enlace enviado a ${correo}. Revisa tu bandeja de entrada.`);
        return;
      }

      if (modo === "crear") {
        const { data, error: err } = await supabase.auth.signUp({
          email: correo,
          password: clave,
          options: {
            data: { full_name: nombre, rol: "cliente" },
            emailRedirectTo: new URL("/auth/callback", window.location.origin).toString(),
          },
        });
        if (err) throw err;
        if (!data.session) {
          setAviso("Cuenta creada. Confirma tu correo para poder entrar.");
          return;
        }
        router.push(destino("cliente"));
        return;
      }

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: correo,
        password: clave,
      });
      if (err) throw err;
      const rol = (data.user?.app_metadata?.rol ?? data.user?.user_metadata?.rol) as Rol | undefined;
      router.push(destino(rol ?? "cliente"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar el acceso.");
    } finally {
      setCargando(null);
    }
  }

  function entrar(sesion: Sesion) {
    entrarLocal(sesion);
    router.push(destino(sesion.rol));
  }

  return (
    <main className="login-page">
      <div className="login-shell anim-in">
        {/* Panel de marca */}
        <section className="login-story">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <Scissors className="h-4 w-4" />
            </span>
            <Marca />
          </Link>
          <div className="login-story-copy">
            <p className="login-kicker">Barbershop</p>
            <h1>Bienvenido de vuelta.</h1>
            <p>Inicia sesión para continuar gestionando tus citas, tus pagos y tu estilo.</p>
          </div>
          <div className="login-flow" aria-label="Flujo conectado">
            <span>
              <CalendarCheck className="h-4 w-4" /> Reserva
            </span>
            <span>
              <CreditCard className="h-4 w-4" /> Pago
            </span>
            <span>
              <ShieldCheck className="h-4 w-4" /> Seguimiento
            </span>
          </div>
          <p className="login-local-note">
            <span />{" "}
            {authDisponible
              ? "Sesión cifrada · cookies HttpOnly y renovación automática"
              : "Modo local · los datos viven en este navegador"}
          </p>
        </section>

        {/* Panel de acceso */}
        <section className="login-access">
          <Link href="/" className="login-back">
            ← Volver al inicio
          </Link>
          <header>
            <p className="login-kicker" style={{ color: "var(--gold)" }}>
              Acceso
            </p>
            <h2>{texto.titulo}</h2>
            <p>{texto.lead}</p>
          </header>

          {/* Google primero: es la vía más rápida y la que menos fricción tiene */}
          <button type="button" onClick={entrarConGoogle} className="login-google" disabled={cargando !== null}>
            {cargando === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleMark className="h-4 w-4" />
            )}
            Continuar con Google
          </button>

          <div className="login-divider">
            <span />o con tu correo<span />
          </div>

          <form onSubmit={enviar}>
            {modo === "crear" && (
              <div className="login-field">
                <label htmlFor="nombre">Nombre completo</label>
                <div className="login-input-wrap">
                  <input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="email">Correo electrónico</label>
              <div className="login-input-wrap">
                <input
                  id="email"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {modo !== "enlace" && (
              <div className="login-field">
                <label htmlFor="pass">Contraseña</label>
                <div className="login-input-wrap">
                  <input
                    id="pass"
                    type={verClave ? "text" : "password"}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete={modo === "crear" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {modo === "entrar" && (
              <div className="login-options">
                <label className="login-remember">
                  <input type="checkbox" defaultChecked /> Recordarme
                </label>
                <button type="button" className="login-forgot" onClick={() => setModo("enlace")}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {error && (
              <p className="login-alert is-error" role="alert">
                <AlertCircle /> {error}
              </p>
            )}
            {aviso && (
              <p className="login-alert is-ok" role="status">
                <CheckCircle2 /> {aviso}
              </p>
            )}

            <button type="submit" className="btn-gold login-submit" disabled={cargando !== null}>
              {cargando === "correo" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {texto.accion}
            </button>
          </form>

          <div className="login-modes">
            {modo !== "enlace" && (
              <button type="button" onClick={() => setModo("enlace")}>
                <Mail /> Entrar con enlace mágico
              </button>
            )}
            {modo !== "entrar" && (
              <button type="button" onClick={() => setModo("entrar")}>
                Ya tengo cuenta
              </button>
            )}
            {modo !== "crear" && (
              <button type="button" onClick={() => setModo("crear")}>
                Crear una cuenta
              </button>
            )}
          </div>

          {!authDisponible && listo && (
            <AccesoLocal
              barberos={barberos.filter((b) => b.activo).map((b) => ({ id: b.id, nombre: b.nombre, subtitulo: b.especialidad }))}
              clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, subtitulo: c.telefono || "Cliente" }))}
              onEntrar={entrar}
              onRegistrarCliente={(nombre, telefono) => {
                const cliente = registrarCliente({ nombre, telefono, email: "" });
                entrar({ rol: "cliente", id: cliente.id, nombre: cliente.nombre, subtitulo: "Cliente" });
              }}
            />
          )}

          {authDisponible && (
            <p className="login-footnote">
              Acceso con Supabase Auth: OAuth de Google (PKCE), verificación de correo y sesión en
              cookies HttpOnly.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

type Perfil = { id: string; nombre: string; subtitulo: string };

/**
 * Acceso mientras el proyecto no está conectado a Supabase. No hay cuentas de
 * ejemplo: se entra como administración para configurar el negocio, o como
 * uno de los barberos y clientes que ya se dieron de alta.
 */
function AccesoLocal({
  barberos,
  clientes,
  onEntrar,
  onRegistrarCliente,
}: {
  barberos: Perfil[];
  clientes: Perfil[];
  onEntrar: (s: Sesion) => void;
  onRegistrarCliente: (nombre: string, telefono: string) => void;
}) {
  const [abierto, setAbierto] = useState<null | "barbero" | "cliente">(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  return (
    <>
      <div className="login-divider">
        <span />acceso local<span />
      </div>
      <div className="login-role-list">
        <button onClick={() => onEntrar(SESION_ADMIN_LOCAL)} className="login-role anim-in anim-d1">
          <span className="login-role-icon role-admin"><ShieldCheck className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <strong>Administración</strong>
            <small>Configura el negocio</small>
            <span className="login-role-copy">Datos de la portada, servicios, equipo, clientes y tarjetas de lealtad.</span>
          </span>
          <ArrowRight className="login-role-arrow" />
        </button>

        <button
          onClick={() => setAbierto(abierto === "barbero" ? null : "barbero")}
          className="login-role anim-in anim-d2"
          aria-expanded={abierto === "barbero"}
        >
          <span className="login-role-icon role-barbero"><Scissors className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <strong>Barbero</strong>
            <small>{barberos.length} en el equipo</small>
            <span className="login-role-copy">Agenda del día, fichas de clientes y horarios.</span>
          </span>
          <ArrowRight className="login-role-arrow" />
        </button>
        {abierto === "barbero" && (
          <ListaPerfiles
            vacio="Aún no hay barberos. Dalos de alta desde Administración → Equipo."
            perfiles={barberos}
            onElegir={(p) => onEntrar({ rol: "barbero", ...p })}
          />
        )}

        <button
          onClick={() => setAbierto(abierto === "cliente" ? null : "cliente")}
          className="login-role anim-in anim-d3"
          aria-expanded={abierto === "cliente"}
        >
          <span className="login-role-icon role-cliente"><User className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <strong>Cliente</strong>
            <small>{clientes.length} registrados</small>
            <span className="login-role-copy">Reservas, pagos y tarjeta de lealtad con Google Wallet.</span>
          </span>
          <ArrowRight className="login-role-arrow" />
        </button>
        {abierto === "cliente" && (
          <div className="space-y-3 rounded-2xl p-3 ring-1 ring-white/10">
            {clientes.length > 0 && (
              <ListaPerfiles vacio="" perfiles={clientes} onElegir={(p) => onEntrar({ rol: "cliente", ...p, subtitulo: "Cliente" })} />
            )}
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (nombre.trim().length < 2) return;
                onRegistrarCliente(nombre.trim(), telefono.trim());
              }}
            >
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Registrarme como cliente nuevo</p>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                className="rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm"
                required
              />
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Teléfono (opcional)"
                type="tel"
                className="rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm"
              />
              <button type="submit" className="btn-gold rounded-xl py-2 text-sm">
                Crear mi tarjeta y entrar
              </button>
            </form>
          </div>
        )}
      </div>
      <p className="login-footnote">
        Este acceso sólo existe mientras no está conectado Supabase. Al definir
        NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY se desactiva y entra el acceso
        real con Google y correo.
      </p>
    </>
  );
}

function ListaPerfiles({
  perfiles,
  vacio,
  onElegir,
}: {
  perfiles: Perfil[];
  vacio: string;
  onElegir: (p: Perfil) => void;
}) {
  if (perfiles.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-xs" style={{ color: "var(--ink-muted)" }}>
        {vacio}
      </p>
    );
  }
  return (
    <ul className="grid gap-1.5">
      {perfiles.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onElegir(p)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              {p.nombre.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.nombre}</span>
              <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>{p.subtitulo}</span>
            </span>
            <ArrowRight className="h-4 w-4 opacity-50" />
          </button>
        </li>
      ))}
    </ul>
  );
}
