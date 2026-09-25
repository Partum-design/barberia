# Barbería · sitio y sistema de gestión

Sitio público de la barbería y sistema de gestión (agenda, cobros, clientes,
**tarjetas de lealtad con Google Wallet**, inventario, caja y marketing),
construido con **Next.js 15 (App Router)** y **Supabase**, listo para
desplegar en **Vercel**.

El backend y los paneles vienen de BarberByPartum. Este repositorio arranca
**vacío**: sin clientes, barberos, servicios ni cifras de ejemplo. Todo lo que
se ve lo captura el administrador.

## Primeros pasos

```bash
cp .env.example .env.local        # todas las claves son opcionales para arrancar
npm install
npm run dev
```

1. Entra a `/login` → **Acceso local → Administración**.
2. En **Configuración** llena nombre, frase, descripción, dirección, horario,
   contacto y redes. Es exactamente lo que publica la portada.
3. Da de alta **Servicios** (el menú de la portada) y el **Equipo de barberos**.
4. En **Tarjetas de lealtad** emite la tarjeta de tus clientes.

El panel muestra una lista de **Primeros pasos** hasta completar lo anterior.

## Modo local y Supabase

Mientras no haya credenciales de Supabase, la app funciona en **modo local**:
los datos viven en el navegador (`localStorage`) y el acceso es local
(administración, o cualquiera de los barberos y clientes dados de alta). Nada
falla por falta de configuración.

Para conectar Supabase:

```bash
npx supabase link --project-ref <ref>
npx supabase db push              # aplica supabase/migrations/00001 → 00003
```

y define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A partir
de ahí el acceso local desaparece y entra el real (Google OAuth con PKCE,
correo y contraseña, enlace mágico). Registra
`https://<dominio>/auth/callback` como URI de redirección en el proveedor de
Google de Supabase Auth.

| Migración | Contenido |
|---|---|
| `00001_init.sql` | Esquema base, RLS multi-tenant, fidelización y bloqueo de slots |
| `00002_metodo_pago.sql` | Pago en efectivo |
| `00003_lealtad_y_portada.sql` | `clientes`, `tarjetas_lealtad` (emisión automática, sellos de mostrador) y campos de portada en `barberias` |

## Portada del negocio

`/` es el sitio informativo de la barbería, no una página de producto:
portada con estado *abierto/cerrado* en vivo, **Nosotros**, **menú de
servicios** por categoría, **equipo**, **tarjeta de lealtad** y **Visítanos**
(horario, mapa, teléfono, WhatsApp, correo y redes). Cada sección se oculta
mientras no tenga contenido.

## Tarjeta de lealtad y Google Wallet

- **Una tarjeta por cliente**, con número `LC-0000-0000` y código QR. Se emite
  sola al registrarse o desde el mostrador.
- **Sellos**: cada cita asistida pone uno automáticamente; el mostrador pone
  los de visitas sin cita. Con N sellos (configurable) se gana el % de
  descuento configurado.
- **Cliente** → `/cuenta/tarjeta`: su tarjeta, QR, historial y botón
  **Agregar a Google Wallet**.
- **Administrador** → `/dashboard/admin/lealtad`: emitir, buscar por nombre,
  teléfono o número, poner/quitar sellos, canjear, suspender y generar el
  enlace de Wallet para mandarlo por WhatsApp.

### Activar Google Wallet

1. En la [Google Pay & Wallet Console](https://pay.google.com/business/console)
   crea la cuenta de emisor y copia el **Issuer ID**.
2. En Google Cloud habilita la **Google Wallet API**, crea una cuenta de
   servicio con clave JSON y agrégala como usuario en la consola de Wallet.
3. Define `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_WALLET_PRIVATE_KEY` y `NEXT_PUBLIC_APP_URL` (dominio público).

```
/api/wallet/lealtad  ─ firma el JWT "savetowallet" (LoyaltyClass + LoyaltyObject)
                      ─ PATCH al objeto si el cliente ya la guardó → sus sellos se actualizan solos
/wallet/logo         ─ logotipo PNG del programa (Wallet no acepta SVG)
```

Mientras el emisor está en modo de prueba, sólo las cuentas de prueba del
emisor pueden guardar el pase; Google lo abre al público tras aprobarlo. El
pase es informativo: el canje se valida siempre contra el sistema con el QR.

## Módulos del panel de administración

| Módulo | Ruta |
|---|---|
| Panel | `/dashboard/admin` |
| Marketing (GA4 + Google Ads) | `/dashboard/admin/marketing` |
| Clientes | `/dashboard/admin/clientes` |
| **Tarjetas de lealtad** | `/dashboard/admin/lealtad` |
| Equipo | `/dashboard/admin/equipo` |
| Servicios | `/dashboard/admin/servicios` |
| Inventario | `/dashboard/admin/inventario` |
| Caja y finanzas | `/dashboard/admin/caja` |
| Reportes | `/dashboard/admin/reportes` |
| Integraciones | `/dashboard/admin/integraciones` |
| Configuración | `/dashboard/admin/configuracion` |

Sin credenciales de GA4 o Google Ads, el panel de marketing muestra las
métricas en cero con el aviso de qué variable falta: nunca cifras inventadas.

## Documentación

- [`docs/DESPLIEGUE_VERCEL.md`](docs/DESPLIEGUE_VERCEL.md) — variables de entorno y despliegue.
- [`docs/INTEGRACION_CALENDARIOS_OAUTH.md`](docs/INTEGRACION_CALENDARIOS_OAUTH.md) — Google Calendar / Outlook.
- [`docs/PLAN_REDISENO_2026.md`](docs/PLAN_REDISENO_2026.md) — sistema de diseño.
