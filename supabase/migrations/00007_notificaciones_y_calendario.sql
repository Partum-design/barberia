-- ============================================================================
-- 00007 · Notificaciones, avisos push y vínculo con Google Calendar
--
-- Las tres tablas son sólo del servidor (igual que estado_app): RLS activo,
-- sin políticas y sin permisos para anon/authenticated. La API de Next las
-- usa con la llave service_role y aplica los permisos de cada sesión.
--
-- `usuario_id` es el id de la sesión de la app: el uuid de Auth para el
-- personal y, para un cliente dado de alta en mostrador, el id de su ficha.
-- ============================================================================

-- Bandeja de avisos de cada persona (campana del panel).
create table if not exists public.notificaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id text not null,
  titulo     text not null,
  cuerpo     text not null default '',
  url        text not null default '/',
  leida      boolean not null default false,
  creado_en  timestamptz not null default now()
);
create index if not exists notificaciones_usuario_idx on public.notificaciones (usuario_id, creado_en desc);

-- Suscripciones Web Push de cada navegador o app instalada.
create table if not exists public.push_suscripciones (
  endpoint   text primary key,
  usuario_id text not null,
  p256dh     text not null,
  auth       text not null,
  creado_en  timestamptz not null default now()
);
create index if not exists push_suscripciones_usuario_idx on public.push_suscripciones (usuario_id);

-- Refresh token de Google para escribir las citas en su calendario.
create table if not exists public.google_calendario (
  usuario_id     text primary key,
  refresh_token  text not null,
  email          text,
  actualizado_en timestamptz not null default now()
);

alter table public.notificaciones     enable row level security;
alter table public.push_suscripciones enable row level security;
alter table public.google_calendario  enable row level security;

revoke all on public.notificaciones     from anon, authenticated;
revoke all on public.push_suscripciones from anon, authenticated;
revoke all on public.google_calendario  from anon, authenticated;
