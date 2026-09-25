# HAIRCUT · Barber OS

Sistema de gestión para barberías —agenda, cobros, clientes, inventario, caja y
marketing— construido con **Next.js 15 (App Router)**, **Supabase** (PostgreSQL +
Auth + RLS + Realtime) y desplegado en **Vercel**.

Identidad visual **Onyx Atelier**: base onyx cálido, latón pulido como único
acento de acción y oxblood reservado a la herencia del oficio. El razonamiento
completo del rediseño está en [`docs/PLAN_REDISENO_2026.md`](docs/PLAN_REDISENO_2026.md).

## Nodos de usuario

| Nodo | Acceso | Capacidades |
|---|---|---|
| **Cliente** | Público / autenticado | Buscar barberos, ver disponibilidad en tiempo real (Supabase Realtime sobre `citas`), reservar con bloqueo de slot de 10 min, pagar con Stripe o Mercado Pago y consultar sus métodos guardados y recompensas |
| **Barbero** | Privado | Agenda diaria/mensual, fichas de servicio y preferencias por cliente, configuración de horarios, conexión de Google Calendar / Outlook |
| **Admin de barbería** | Privado | Marketing (GA4 + Google Ads), CRM de clientes, equipo, catálogo de servicios, inventario, caja y finanzas, reportes e integraciones |

## Módulos del panel de administración

| Módulo | Ruta | Qué resuelve |
|---|---|---|
| Panel | `/dashboard/admin` | Indicadores del negocio y agenda mensual completa |
| **Marketing** | `/dashboard/admin/marketing` | Audiencia (GA4), campañas (Google Ads) y atribución del clic al sillón |
| **Clientes** | `/dashboard/admin/clientes` | Ficha 360, gasto, frecuencia, barbero de confianza y riesgo de fuga |
| Equipo | `/dashboard/admin/equipo` | Altas, bajas y producción de cada barbero |
| **Servicios** | `/dashboard/admin/servicios` | Catálogo con precio, duración y comisión |
| **Inventario** | `/dashboard/admin/inventario` | Existencias, mínimos, valor de almacén y alertas de reposición |
| **Caja y finanzas** | `/dashboard/admin/caja` | Corte del periodo, método de cobro, comisiones, gastos y utilidad |
| Reportes | `/dashboard/admin/reportes` | Series históricas del negocio |
| **Integraciones** | `/dashboard/admin/integraciones` | Estado de cada conexión y variables que faltan por definir |

## Acceso al sistema

- **Google OAuth con PKCE** sobre Supabase Auth: el código se canjea en el
  servidor (`/auth/callback`) y la sesión vive en cookies HttpOnly.
- Correo y contraseña, alta de cuenta y **enlace mágico** sin contraseña.
- `src/middleware.ts` refresca la sesión en cada request y protege
  `/dashboard/*` y `/cuenta/*` por rol (`app_metadata.rol` manda sobre
  `user_metadata.rol`, porque el segundo es editable desde el cliente).
- **Sin credenciales de Supabase la app entra en modo demostración**: la sesión
  vive en `localStorage`, todo el producto sigue siendo navegable y la pantalla
  lo dice explícitamente. Nada falla por falta de configuración.

## Integraciones de marketing

```
/api/integrations/analytics   ─ GA4 Data API v1 batchRunReports  (JWT RS256 de cuenta de servicio)
/api/integrations/google-ads  ─ googleAds:searchStream con GAQL  (refresh token OAuth)
/api/integrations/estado      ─ qué variables de entorno están definidas (nunca sus valores)
      ↓ ambos adaptadores normalizan a src/lib/integrations/tipos.ts
      ↓ sin credenciales → juego de demostración determinista, marcado en pantalla
```

Ambos adaptadores usan `fetch` y `node:crypto`, sin `googleapis` ni
`google-auth-library`: son dos llamadas HTTP y una firma RS256, y las librerías
oficiales añadirían decenas de megas al bundle del servidor. El adaptador de
Meta Ads está declarado con el mismo contrato y apagado por defecto.

## Arquitectura

```
Next.js (Vercel)
├── Middleware Edge ─ rate limiting (Upstash) + sesión Supabase + guardas por rol
├── Server Components ─ queries con anon key protegidas por RLS
├── Route Handlers (service_role)
│   ├── /api/bookings ─ Turnstile + OTP + fn_bloquear_slot (RPC)
│   ├── /api/webhooks/stripe ─ confirma pagos → dispara fidelización
│   ├── /api/integrations/* ─ GA4, Google Ads y estado de configuración
│   └── /auth/callback · /auth/signout ─ PKCE y cierre de sesión server-side
└── Supabase
    ├── PostgreSQL con RLS multi-tenant (barberia_id)
    ├── Trigger de fidelización (N citas asistidas+pagadas → recompensa)
    ├── Exclusion constraint anti doble-reserva (tstzrange + gist)
    └── pg_cron ─ libera slots bloqueados no pagados cada minuto
```

## Elementos 3D

Piezas construidas con geometría propia, no con primitivas apiladas:

- **Tijera de barbero** (`src/components/three/Shears.tsx`): cada hoja se barre
  desde un perfil real —filo de espesor cero, lomo grueso— que se estrecha hasta
  la punta; mangos lofteados sobre curvas y pivote torneado con ranura. Las dos
  mitades giran sobre el mismo eje.
- **Poste de barbería** (`src/components/three/BarberPoleModel.tsx`): hélices con
  volumen dentro de una funda de vidrio, con remates de revolución.
- El entorno de reflexión es procedural (`Lightformer` dentro de `Environment`):
  reflejos de estudio reales sin descargar ningún HDR externo.
- Se apaga con `prefers-reduced-motion` y sin WebGL, y el bucle de render se
  detiene cuando el lienzo sale del viewport.

## Seguridad antibots / antifraude

- **Cloudflare Turnstile** invisible en el flujo de reserva (verificación server-side).
- **Rate limiting** estricto en `src/middleware.ts` sobre `/api/bookings` y `/api/search`.
- **OTP obligatorio** (Twilio Verify vía SMS/WhatsApp): `fn_bloquear_slot` rechaza clientes sin `telefono_verificado`.
- **Bloqueo de slot 10 min**: `citas.bloqueo_expira_en` + limpieza por `pg_cron`; máximo 3 bloqueos simultáneos por cliente.
- **RLS**: barberos solo leen sus citas; admins solo datos de su barbería; los tokens OAuth nunca se exponen (vista `directorio_barberos`).

## Documentación

- [`docs/PLAN_REDISENO_2026.md`](docs/PLAN_REDISENO_2026.md) — investigación, sistema de diseño y plan de módulos.
- [`supabase/migrations/00001_init.sql`](supabase/migrations/00001_init.sql) — esquema completo, triggers, RPCs y políticas RLS.
- [`docs/DESPLIEGUE_VERCEL.md`](docs/DESPLIEGUE_VERCEL.md) — variables de entorno, `vercel.json` y CI/CD.
- [`docs/INTEGRACION_CALENDARIOS_OAUTH.md`](docs/INTEGRACION_CALENDARIOS_OAUTH.md) — flujo OAuth2 bidireccional con Google y Microsoft.

## Inicio rápido

```bash
cp .env.example .env.local        # todas las claves son opcionales para arrancar
npm install
npm run dev                       # arranca en modo demostración si no hay Supabase
```

Con Supabase conectado:

```bash
npx supabase link --project-ref <ref>
npx supabase db push              # aplica supabase/migrations/
```

Para el acceso con Google hay que registrar `https://<dominio>/auth/callback`
como URI de redirección autorizada en el proveedor de Google dentro de Supabase
Auth.
