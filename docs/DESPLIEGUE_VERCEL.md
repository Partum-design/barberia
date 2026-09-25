# Guía de Despliegue en Vercel — Barber OS

## 1. Variables de entorno requeridas

Configúralas en **Vercel → Project → Settings → Environment Variables**, separando por entorno (`Production`, `Preview`, `Development`).

### Supabase
| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + Servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente + Servidor | Llave pública (anon/publishable). Segura porque RLS protege los datos |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** | Bypass de RLS. Úsala únicamente en Route Handlers/webhooks. Jamás con prefijo `NEXT_PUBLIC_` |

### Stripe
| Variable | Ámbito | Descripción |
|---|---|---|
| `STRIPE_SECRET_KEY` | Solo servidor | Llave secreta de la cuenta plataforma |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Cliente | Llave pública para Stripe.js/Elements |
| `STRIPE_WEBHOOK_SECRET` | Solo servidor | Firma de webhooks (`checkout.session.completed`, `invoice.paid`) |
| `STRIPE_CONNECT_CLIENT_ID` | Solo servidor | Onboarding de barberías con Stripe Connect |

### Integraciones de calendario (OAuth2)
| Variable | Ámbito | Descripción |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Solo servidor | App OAuth de Google Cloud (scopes de Calendar) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Solo servidor | App registrada en Entra ID (Microsoft Graph) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | Solo servidor | Llave AES-256 (32 bytes, base64) para cifrar refresh tokens antes de guardarlos |

### Antibots / OTP / Rate limiting
| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cliente | Cloudflare Turnstile (widget invisible) |
| `TURNSTILE_SECRET_KEY` | Solo servidor | Verificación server-side del token Turnstile |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID` | Solo servidor | OTP por SMS/WhatsApp (Twilio Verify) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Solo servidor | Rate limiting distribuido con `@upstash/ratelimit` |

### App
| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Cliente + Servidor | URL canónica (callbacks OAuth y links de Stripe) |

> Regla de oro: nada sensible lleva prefijo `NEXT_PUBLIC_`. Vercel inyecta esas variables en el bundle del navegador.

## 2. `vercel.json`

Vercel no ofrece rate limiting declarativo en `vercel.json` (eso vive en el Middleware Edge con Upstash, ver `src/middleware.ts`). El archivo se usa para cabeceras de seguridad, redirecciones y ajustes de funciones:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/webhooks/stripe/route.ts": { "maxDuration": 30 },
    "src/app/api/calendar/sync/route.ts": { "maxDuration": 60 }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ],
  "redirects": [
    { "source": "/admin", "destination": "/dashboard/admin", "permanent": false }
  ]
}
```

Notas:
- **Región fija** (`iad1` o la más cercana a tu base de usuarios): mantén las Serverless Functions cerca de la región del proyecto Supabase para minimizar latencia de queries.
- El **rate limiting** se implementa en `middleware.ts` (Edge Runtime + Upstash Redis): límite por IP (`x-forwarded-for`) y por sesión sobre `/api/bookings*` y `/api/search*`. Ver snippet en el repo.
- Los **webhooks de Stripe** requieren el body crudo; en App Router usa `await req.text()` antes de verificar la firma.

## 3. CI/CD

1. Conecta el repositorio de GitHub al proyecto Vercel; cada push a `main` despliega a producción y cada PR genera un Preview Deployment.
2. Protege los previews con **Vercel Authentication** (los previews exponen la misma anon key; RLS sigue siendo la barrera real).
3. Usa **Supabase Branching** para que cada preview apunte a una rama de base de datos aislada (integración oficial Supabase↔Vercel la configura automáticamente).
4. Ejecuta migraciones en el pipeline: `supabase db push` con `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` como secrets de GitHub Actions, antes del deploy.

## 4. Checklist de producción

- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en entorno Production/Preview de servidor, nunca en el cliente.
- [ ] Webhook de Stripe apuntando a `https://<dominio>/api/webhooks/stripe` con los eventos `checkout.session.completed`, `invoice.paid`, `charge.refunded`.
- [ ] Turnstile en modo *invisible/managed* sobre el formulario de reserva.
- [ ] `pg_cron` habilitado en Supabase con el job `liberar-slots` (cada minuto).
- [ ] Dominios de callback OAuth registrados en Google Cloud Console y Entra ID (producción y previews wildcard no están permitidos en Google: usa solo el dominio de producción + localhost).
