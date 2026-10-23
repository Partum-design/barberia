-- ============================================================================
-- 00008 · Límite de intentos y restablecimiento de contraseña
--
--   · limites_intentos           → contador por clave (IP, cuenta) para frenar
--                                  abusos en login, reservas y recuperación.
--   · solicitudes_restablecimiento → el cliente que sólo tiene celular pide
--                                  ayuda; la barbería la atiende en el panel.
--   · tokens_restablecimiento    → enlaces de un solo uso que genera el admin.
--                                  Sólo se guarda el hash SHA-256 del token.
--   · bitacora_restablecimiento  → quién generó enlaces o reinició accesos.
--
-- Como estado_app, ninguna de estas tablas tiene políticas: RLS activado y sin
-- permisos para anon/authenticated. Sólo el servidor (service_role) las toca.
-- ============================================================================

-- --- Límite de intentos -----------------------------------------------------

create table public.limites_intentos (
  clave           text primary key,
  conteo          int not null default 0,
  ventana_inicio  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

alter table public.limites_intentos enable row level security;
revoke all on public.limites_intentos from anon, authenticated;

-- Suma un intento a la clave y dice si todavía está dentro del límite
-- (p_max intentos por ventana de p_segundos). Devuelve false si se pasó.
create or replace function public.fn_limite_consumir(p_clave text, p_max int, p_segundos int)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  fila limites_intentos;
begin
  insert into limites_intentos as l (clave, conteo, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave) do update
    set conteo = case when l.ventana_inicio < now() - make_interval(secs => p_segundos) then 1 else l.conteo + 1 end,
        ventana_inicio = case when l.ventana_inicio < now() - make_interval(secs => p_segundos) then now() else l.ventana_inicio end
  returning * into fila;
  return fila.conteo <= p_max;
end;
$$;

-- Bloqueo por fallos seguidos (contraseña incorrecta): ¿está bloqueada ahora?
create or replace function public.fn_bloqueo_activo(p_clave text)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select bloqueado_hasta from limites_intentos
  where clave = p_clave and bloqueado_hasta > now();
$$;

-- Registra un fallo. Al llegar a p_max fallos seguidos bloquea p_segundos y
-- reinicia la cuenta. Devuelve el fin del bloqueo, o null si no bloqueó.
create or replace function public.fn_registrar_fallo(p_clave text, p_max int, p_segundos int)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  fila limites_intentos;
begin
  insert into limites_intentos as l (clave, conteo, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave) do update set conteo = l.conteo + 1
  returning * into fila;
  if fila.conteo >= p_max then
    update limites_intentos
       set conteo = 0, bloqueado_hasta = now() + make_interval(secs => p_segundos)
     where clave = p_clave
    returning bloqueado_hasta into fila.bloqueado_hasta;
    return fila.bloqueado_hasta;
  end if;
  return null;
end;
$$;

-- Entró bien: se olvidan sus fallos.
create or replace function public.fn_limite_borrar(p_clave text)
returns void
language sql
set search_path = public
as $$
  delete from limites_intentos where clave = p_clave;
$$;

-- --- Restablecimiento de contraseña ------------------------------------------

create table public.solicitudes_restablecimiento (
  id           uuid primary key default gen_random_uuid(),
  -- Ficha del cliente en estado_app (puede no tener cuenta de acceso aún)
  cliente_id   text not null,
  usuario_id   uuid references auth.users (id) on delete set null,
  creada_en    timestamptz not null default now(),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'atendida', 'expirada')),
  atendida_por uuid references auth.users (id) on delete set null,
  atendida_en  timestamptz
);

create index solicitudes_restablecimiento_pendientes
  on public.solicitudes_restablecimiento (creada_en desc) where estado = 'pendiente';
create index solicitudes_restablecimiento_cliente on public.solicitudes_restablecimiento (cliente_id);

create table public.tokens_restablecimiento (
  id         uuid primary key default gen_random_uuid(),
  -- SHA-256 en hexadecimal del token que viaja en el enlace; nunca el token.
  hash       text not null unique,
  cliente_id text not null,
  usuario_id uuid references auth.users (id) on delete cascade,
  creado_en  timestamptz not null default now(),
  expira_en  timestamptz not null,
  usado_en   timestamptz,
  creado_por uuid references auth.users (id) on delete set null
);

create index tokens_restablecimiento_cliente on public.tokens_restablecimiento (cliente_id);

create table public.bitacora_restablecimiento (
  id         bigint generated always as identity primary key,
  cliente_id text not null,
  accion     text not null,
  actor      uuid references auth.users (id) on delete set null,
  actor_nombre text,
  creada_en  timestamptz not null default now(),
  detalle    jsonb not null default '{}'::jsonb
);

create index bitacora_restablecimiento_cliente on public.bitacora_restablecimiento (cliente_id, creada_en desc);

alter table public.solicitudes_restablecimiento enable row level security;
alter table public.tokens_restablecimiento enable row level security;
alter table public.bitacora_restablecimiento enable row level security;
revoke all on public.solicitudes_restablecimiento from anon, authenticated;
revoke all on public.tokens_restablecimiento from anon, authenticated;
revoke all on public.bitacora_restablecimiento from anon, authenticated;

-- Gasta el token si sigue vigente. Lo marca como usado en la misma sentencia,
-- así dos pestañas con el mismo enlace no pueden usarlo las dos.
create or replace function public.fn_consumir_token_restablecimiento(p_hash text)
returns table (cliente_id text, usuario_id uuid)
language sql
set search_path = public
as $$
  update tokens_restablecimiento
     set usado_en = now()
   where hash = p_hash and usado_en is null and expira_en > now()
  returning cliente_id, usuario_id;
$$;

-- Busca la cuenta de acceso por correo (para /recuperar). Lee auth.users, así
-- que es security definer y sólo la puede llamar service_role.
create or replace function public.fn_usuario_por_correo(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

-- Cierra todas las sesiones abiertas de una cuenta (al cambiar la contraseña).
create or replace function public.fn_cerrar_sesiones(p_usuario uuid)
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.sessions where user_id = p_usuario;
$$;

revoke execute on function public.fn_limite_consumir(text, int, int)        from public, anon, authenticated;
revoke execute on function public.fn_bloqueo_activo(text)                   from public, anon, authenticated;
revoke execute on function public.fn_registrar_fallo(text, int, int)        from public, anon, authenticated;
revoke execute on function public.fn_limite_borrar(text)                    from public, anon, authenticated;
revoke execute on function public.fn_consumir_token_restablecimiento(text)  from public, anon, authenticated;
revoke execute on function public.fn_usuario_por_correo(text)               from public, anon, authenticated;
revoke execute on function public.fn_cerrar_sesiones(uuid)                  from public, anon, authenticated;

grant execute on function public.fn_limite_consumir(text, int, int)        to service_role;
grant execute on function public.fn_bloqueo_activo(text)                   to service_role;
grant execute on function public.fn_registrar_fallo(text, int, int)        to service_role;
grant execute on function public.fn_limite_borrar(text)                    to service_role;
grant execute on function public.fn_consumir_token_restablecimiento(text)  to service_role;
grant execute on function public.fn_usuario_por_correo(text)               to service_role;
grant execute on function public.fn_cerrar_sesiones(uuid)                  to service_role;

grant select, insert, update, delete on public.limites_intentos              to service_role;
grant select, insert, update, delete on public.solicitudes_restablecimiento  to service_role;
grant select, insert, update, delete on public.tokens_restablecimiento       to service_role;
grant select, insert, update, delete on public.bitacora_restablecimiento     to service_role;
grant usage on all sequences in schema public to service_role;
