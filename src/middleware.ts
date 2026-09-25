import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { DESTINO_POR_ROL, RUTAS_PROTEGIDAS, resolverRol } from "@/lib/auth/roles";

// ---------------------------------------------------------------------------
// El middleware hace dos trabajos independientes:
//
//   1. Rate limiting en el Edge para los endpoints sensibles a bots.
//   2. Refresco de la sesión de Supabase y guarda de las rutas privadas.
//
// El segundo sólo se activa si el proyecto tiene credenciales de Supabase. Sin
// ellas la app corre en modo demostración, donde la sesión vive en
// `localStorage` y el servidor no puede —ni debe— opinar sobre ella.
// ---------------------------------------------------------------------------

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const authConfigurada =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const limiters = hasRedis
  ? (() => {
      const redis = Redis.fromEnv();
      return {
        // Anti-scraping del directorio de barberos
        search: new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(30, "60 s"),
          prefix: "rl:search",
        }),
        // Anti appointment-scalping
        bookings: new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, "60 s"),
          prefix: "rl:bookings",
        }),
      };
    })()
  : null;

async function limitar(req: NextRequest) {
  if (!limiters) return null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  const session = req.cookies.get("sb-access-token")?.value?.slice(0, 32) ?? "";
  const key = `${ip}:${session}`;

  const limiter = req.nextUrl.pathname.startsWith("/api/bookings")
    ? limiters.bookings
    : limiters.search;

  const { success, reset } = await limiter.limit(key);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(reset) } }
    );
  }
  return null;
}

async function sesionYGuardas(req: NextRequest) {
  // La respuesta se crea primero: es donde Supabase escribe las cookies
  // renovadas. Devolverla siempre —aunque no haya redirección— es lo que
  // mantiene la sesión viva sin que el usuario tenga que volver a entrar.
  const respuesta = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookies.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            respuesta.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() valida el token contra Supabase; getSession() sólo lee la cookie
  // y por tanto no sirve para tomar decisiones de autorización.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = req.nextUrl.pathname;
  const regla = RUTAS_PROTEGIDAS.find((r) => ruta.startsWith(r.prefijo));

  // Al redirigir se arrastran las cookies recién renovadas; si no, el refresco
  // de este ciclo se perdería y el usuario podría quedar en un bucle de login.
  const redirigir = (destino: URL) => {
    const salida = NextResponse.redirect(destino);
    respuesta.cookies.getAll().forEach((cookie) => salida.cookies.set(cookie));
    return salida;
  };

  if (regla) {
    if (!user) {
      const destino = new URL("/login", req.url);
      destino.searchParams.set("next", ruta);
      return redirigir(destino);
    }
    const rol = resolverRol(user);
    if (!regla.roles.includes(rol)) {
      return redirigir(new URL(DESTINO_POR_ROL[rol], req.url));
    }
  }

  // Ya autenticado: la pantalla de acceso no tiene nada que ofrecer.
  if (ruta === "/login" && user) {
    return redirigir(new URL(DESTINO_POR_ROL[resolverRol(user)], req.url));
  }

  return respuesta;
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return (await limitar(req)) ?? NextResponse.next();
  }
  if (!authConfigurada) return NextResponse.next();
  return sesionYGuardas(req);
}

export const config = {
  matcher: [
    "/api/bookings/:path*",
    "/api/search/:path*",
    "/dashboard/:path*",
    "/cuenta/:path*",
    "/login",
  ],
};
