# Integración OAuth2 bidireccional — Google Calendar y Microsoft Outlook

Objetivo: cuando se confirma una cita, la plataforma crea el evento en el calendario del barbero — con la dirección del cliente en la ubicación si el servicio es a domicilio; si el barbero mueve/borra el evento desde su calendario, la cita se actualiza en Supabase.

## Arquitectura general

```
Cliente paga cita ──► Webhook Stripe ──► Route Handler (service_role)
                                          ├── crea evento en Google/Microsoft
                                          ├── guarda dirección de domicilio en `citas` (si aplica)
                                          └── guarda `evento_calendario_id`

Barbero mueve evento ──► Webhook push (Google) / Graph subscription (Microsoft)
                        ──► /api/calendar/notify ──► actualiza `citas`
```

**Decisión clave:** NO usamos el OAuth de Supabase Auth para esto. Supabase Auth sirve para iniciar sesión, pero no persiste refresh tokens de terceros de forma utilizable a largo plazo. En su lugar, hacemos un flujo OAuth2 *de conexión* independiente y guardamos el refresh token **cifrado** (AES-256-GCM con `OAUTH_TOKEN_ENCRYPTION_KEY`) en `barberos.calendario_refresh_token_cifrado`.

## Paso a paso — Google

1. **Registro**: en Google Cloud Console crea credenciales OAuth 2.0 (tipo Web), con redirect URI `https://<app>/api/calendar/google/callback`. Scopes: `https://www.googleapis.com/auth/calendar.events` (mínimo necesario, no `calendar` completo).
2. **Conexión (desde el dashboard del barbero)**: el botón "Conectar Google Calendar" redirige a `https://accounts.google.com/o/oauth2/v2/auth` con `access_type=offline`, `prompt=consent` y un `state` firmado (JWT corto con el `barbero_id` y expiración de 10 min) para prevenir CSRF.
3. **Callback**: `/api/calendar/google/callback` valida `state`, intercambia `code` por `{access_token, refresh_token}` contra `https://oauth2.googleapis.com/token`, cifra el refresh token y lo guarda con el cliente `service_role` (la columna no es legible por RLS desde el navegador; la vista pública `directorio_barberos` la excluye).
4. **Salida (nuestra app → Google)**: al confirmarse el pago, el Route Handler descifra el refresh token, obtiene un access token fresco y llama `POST /calendars/primary/events`. Si la cita es a domicilio, se envía `location` con la dirección capturada en `citas.direccion_domicilio`; si es en barbería, el evento apunta a la dirección de la sucursal.
5. **Entrada (Google → nuestra app)**: registra un canal push con `POST /calendars/primary/events/watch` apuntando a `https://<app>/api/calendar/notify?provider=google`. Los canales expiran (~7 días): renuévalos con un cron (Vercel Cron o Supabase Edge Function programada). Al recibir una notificación, haz un *incremental sync* con el `syncToken` guardado en `barberos.calendario_sync_token` y reconcilia: evento movido → actualiza `inicio/fin` de la cita; evento borrado → marca la cita para revisión del barbero.

## Paso a paso — Microsoft

1. **Registro**: en Entra ID (Azure Portal) registra una app multitenant con redirect `https://<app>/api/calendar/microsoft/callback`. Permisos delegados de Microsoft Graph: `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite`, `offline_access`.
2. **Conexión**: authorize endpoint `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`; mismo patrón de `state` firmado. El token endpoint devuelve refresh token gracias a `offline_access`.
3. **Salida**: crea el evento con `POST /me/events` estableciendo `location.displayName` con la dirección de domicilio (`citas.direccion_domicilio`) o la dirección de la barbería según la modalidad.
4. **Entrada**: crea una *subscription* de Graph (`POST /subscriptions`) sobre `/me/events` con `notificationUrl = https://<app>/api/calendar/notify?provider=microsoft`. Graph valida la URL con un handshake (`validationToken` que debes devolver en texto plano). Las suscripciones expiran (máx ~3 días para calendario): renueva con el mismo cron. Usa `PATCH /subscriptions/{id}` para extender.
5. **Delta sync**: para reconciliar cambios usa `GET /me/calendarView/delta` guardando el `deltaLink` en `calendario_sync_token`.

## Reglas de seguridad transversales

- Refresh tokens siempre cifrados en reposo; el descifrado ocurre solo en Route Handlers de servidor. Alternativa nativa: Supabase Vault.
- `state` OAuth firmado y de un solo uso; rechaza callbacks sin él.
- Webhooks de notificación no llevan datos sensibles: trátalos solo como "señal de re-sincronizar" y ve siempre a la API a leer el estado real (evita spoofing).
- Verifica en cada notificación de Google la cabecera `X-Goog-Channel-Token` (secreto por canal) y en Microsoft el `clientState` de la suscripción.
- Al desconectar la integración, revoca el token (`https://oauth2.googleapis.com/revoke` / borrar suscripción Graph) y limpia las columnas.
