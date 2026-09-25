-- ============================================================================
-- Barber OS — Inicialización de Base de Datos (Supabase / PostgreSQL)
-- SaaS B2B para gestión de barberías y barberos independientes.
--
-- Incluye: esquema completo, llaves foráneas, índices, triggers de
-- fidelización, bloqueo temporal de slots y políticas RLS por rol.
-- ============================================================================

-- Extensiones -----------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- búsqueda difusa de barberos

-- ============================================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================================
create type rol_usuario as enum ('cliente', 'barbero', 'admin_barberia', 'superadmin');
create type estado_cita as enum ('bloqueada', 'pendiente_pago', 'confirmada', 'asistida', 'cancelada', 'no_asistio');
create type modalidad_cita as enum ('presencial', 'domicilio');
create type estado_pago as enum ('pendiente', 'pagado', 'reembolsado', 'fallido');
create type proveedor_calendario as enum ('google', 'microsoft');
create type tipo_recompensa as enum ('descuento_porcentaje', 'cita_gratis');

-- ============================================================================
-- 2. TABLAS PRINCIPALES
-- ============================================================================

-- Barberías (tenant raíz del modelo multi-tenant) ------------------------------
create table public.barberias (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  slug          text not null unique,
  logo_url      text,
  direccion     text,
  telefono      text,
  stripe_account_id text,                -- Stripe Connect para cobros de citas
  suscripcion_activa boolean not null default false,
  stripe_subscription_id text,           -- Suscripción SaaS de la barbería
  creado_en     timestamptz not null default now()
);

-- Perfiles de usuario (espejo de auth.users) ----------------------------------
create table public.usuarios (
  id            uuid primary key references auth.users(id) on delete cascade,
  rol           rol_usuario not null default 'cliente',
  barberia_id    uuid references public.barberias(id) on delete set null,
  nombre        text not null,
  apellidos     text,
  email         text not null,
  telefono      text,
  telefono_verificado boolean not null default false,   -- OTP SMS/WhatsApp
  avatar_url    text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Barberos ---------------------------------------------------------------------
create table public.barberos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null unique references public.usuarios(id) on delete cascade,
  barberia_id    uuid not null references public.barberias(id) on delete cascade,
  especialidad  text not null,
  certificacion text,
  biografia     text,
  precio_servicio numeric(10,2) not null default 0,
  duracion_cita_min int not null default 30,
  acepta_domicilio boolean not null default true,
  activo        boolean not null default true,
  -- Tokens OAuth cifrados (Vault/pgsodium recomendado en producción)
  calendario_proveedor proveedor_calendario,
  calendario_refresh_token_cifrado text,
  calendario_sync_token text,
  creado_en     timestamptz not null default now()
);

create index idx_barberos_barberia on public.barberos (barberia_id);
create index idx_barberos_especialidad_trgm on public.barberos using gin (especialidad gin_trgm_ops);

-- Horarios de disponibilidad --------------------------------------------------
create table public.horarios_barberos (
  id            uuid primary key default gen_random_uuid(),
  barbero_id     uuid not null references public.barberos(id) on delete cascade,
  dia_semana    smallint not null check (dia_semana between 0 and 6),
  hora_inicio   time not null,
  hora_fin      time not null,
  check (hora_inicio < hora_fin)
);

create index idx_horarios_barbero on public.horarios_barberos (barbero_id);

-- Citas -------------------------------------------------------------------
create table public.citas (
  id            uuid primary key default gen_random_uuid(),
  barberia_id    uuid not null references public.barberias(id) on delete cascade,
  barbero_id     uuid not null references public.barberos(id) on delete cascade,
  cliente_id   uuid references public.usuarios(id) on delete set null,
  inicio        timestamptz not null,
  fin           timestamptz not null,
  modalidad     modalidad_cita not null default 'presencial',
  estado        estado_cita not null default 'bloqueada',
  -- Protección de inventario: el slot expira si no se paga en 10 minutos
  bloqueo_expira_en timestamptz default (now() + interval '10 minutes'),
  precio        numeric(10,2) not null,
  descuento_aplicado numeric(10,2) not null default 0,
  recompensa_id uuid,                              -- FK diferida (ver abajo)
  direccion_domicilio text,                        -- dirección para servicio a domicilio
  evento_calendario_id text,                       -- id del evento sincronizado
  servicio_solicitado text,
  creado_en     timestamptz not null default now(),
  check (inicio < fin),
  -- Evita doble reserva del mismo slot para citas vivas
  constraint citas_sin_solape exclude using gist (
    barbero_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado in ('bloqueada', 'pendiente_pago', 'confirmada'))
);

create index idx_citas_barbero_inicio on public.citas (barbero_id, inicio);
create index idx_citas_cliente on public.citas (cliente_id);
create index idx_citas_barberia on public.citas (barberia_id);
create index idx_citas_expiracion on public.citas (bloqueo_expira_en)
  where estado = 'bloqueada';

-- Extensión requerida por la restricción de exclusión con uuid
create extension if not exists btree_gist;

-- Pagos -------------------------------------------------------------------
create table public.pagos (
  id            uuid primary key default gen_random_uuid(),
  cita_id       uuid not null unique references public.citas(id) on delete cascade,
  barberia_id    uuid not null references public.barberias(id) on delete cascade,
  cliente_id   uuid not null references public.usuarios(id),
  monto         numeric(10,2) not null,
  moneda        text not null default 'MXN',
  estado        estado_pago not null default 'pendiente',
  stripe_payment_intent_id text unique,
  creado_en     timestamptz not null default now(),
  pagado_en     timestamptz
);

create index idx_pagos_barberia on public.pagos (barberia_id);

-- Fichas de servicio y preferencias del cliente ------------------------------
create table public.fichas (
  id            uuid primary key default gen_random_uuid(),
  barberia_id    uuid not null references public.barberias(id) on delete cascade,
  cliente_id   uuid not null references public.usuarios(id) on delete cascade,
  barbero_id     uuid not null references public.barberos(id) on delete cascade,
  cita_id       uuid references public.citas(id) on delete set null,
  notas         text,
  servicio      text,
  preferencias  jsonb,
  creado_en     timestamptz not null default now()
);

create index idx_fichas_cliente on public.fichas (cliente_id);
create index idx_fichas_barbero on public.fichas (barbero_id);

-- ============================================================================
-- 3. PROGRAMA DE FIDELIZACIÓN
-- ============================================================================

-- Configuración de recompensas por barbería ---------------------------------
create table public.recompensas_config (
  id            uuid primary key default gen_random_uuid(),
  barberia_id    uuid not null references public.barberias(id) on delete cascade,
  citas_requeridas int not null default 5,
  tipo          tipo_recompensa not null default 'descuento_porcentaje',
  valor         numeric(10,2) not null default 20,   -- 20% o precio 0
  activa        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- Historial de fidelidad ------------------------------------------------------
create table public.historial_fidelidad (
  id            uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.usuarios(id) on delete cascade,
  barberia_id    uuid not null references public.barberias(id) on delete cascade,
  cita_id       uuid references public.citas(id) on delete set null,
  puntos        int not null default 1,
  recompensa_desbloqueada boolean not null default false,
  recompensa_config_id uuid references public.recompensas_config(id),
  canjeada      boolean not null default false,
  canjeada_en   timestamptz,
  creado_en     timestamptz not null default now()
);

create index idx_fidelidad_cliente_barberia
  on public.historial_fidelidad (cliente_id, barberia_id);

-- FK diferida de citas.recompensa_id
alter table public.citas
  add constraint citas_recompensa_fk
  foreign key (recompensa_id) references public.historial_fidelidad(id);

-- Trigger: al marcar una cita como 'asistida' y pagada, acumula un punto.
-- Cada N citas (config de la barbería) desbloquea la recompensa.
create or replace function public.fn_acumular_fidelidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config recompensas_config%rowtype;
  v_puntos int;
begin
  if new.estado = 'asistida' and old.estado is distinct from 'asistida'
     and new.cliente_id is not null
     and exists (select 1 from pagos p where p.cita_id = new.id and p.estado = 'pagado')
  then
    select * into v_config
      from recompensas_config
     where barberia_id = new.barberia_id and activa
     order by creado_en desc limit 1;

    insert into historial_fidelidad (cliente_id, barberia_id, cita_id)
    values (new.cliente_id, new.barberia_id, new.id);

    if v_config.id is not null then
      select coalesce(sum(puntos), 0) into v_puntos
        from historial_fidelidad
       where cliente_id = new.cliente_id
         and barberia_id = new.barberia_id
         and not recompensa_desbloqueada
         and not canjeada;

      if v_puntos >= v_config.citas_requeridas then
        -- Desbloquea la recompensa y reinicia el contador marcando los puntos
        update historial_fidelidad
           set recompensa_desbloqueada = true,
               recompensa_config_id = v_config.id
         where cliente_id = new.cliente_id
           and barberia_id = new.barberia_id
           and not recompensa_desbloqueada
           and not canjeada;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_fidelidad
  after update on public.citas
  for each row execute function public.fn_acumular_fidelidad();

-- ============================================================================
-- 4. FUNCIONES DE NEGOCIO (RPC seguras)
-- ============================================================================

-- Bloqueo temporal de slot (anti-scalping): reserva por 10 minutos.
create or replace function public.fn_bloquear_slot(
  p_barbero_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_modalidad modalidad_cita default 'presencial'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cita_id uuid;
  v_barbero barberos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- El cliente debe tener teléfono verificado por OTP antes de reservar
  if not exists (
    select 1 from usuarios
     where id = auth.uid() and telefono_verificado
  ) then
    raise exception 'Teléfono no verificado';
  end if;

  -- Máximo 3 slots bloqueados simultáneos por cliente (anti-hoarding)
  if (select count(*) from citas
       where cliente_id = auth.uid()
         and estado = 'bloqueada'
         and bloqueo_expira_en > now()) >= 3 then
    raise exception 'Límite de reservas simultáneas alcanzado';
  end if;

  select * into v_barbero from barberos where id = p_barbero_id and activo;
  if not found then
    raise exception 'Barbero no disponible';
  end if;

  insert into citas (barberia_id, barbero_id, cliente_id, inicio, fin,
                     modalidad, estado, precio, bloqueo_expira_en)
  values (v_barbero.barberia_id, p_barbero_id, auth.uid(), p_inicio, p_fin,
          p_modalidad, 'bloqueada', v_barbero.precio_servicio,
          now() + interval '10 minutes')
  returning id into v_cita_id;

  return v_cita_id;
end;
$$;

-- Liberación de slots expirados (invocar por pg_cron cada minuto)
create or replace function public.fn_liberar_slots_expirados()
returns int
language sql
security definer
set search_path = public
as $$
  with liberadas as (
    update citas
       set estado = 'cancelada'
     where estado = 'bloqueada'
       and bloqueo_expira_en < now()
    returning 1
  )
  select count(*)::int from liberadas;
$$;

-- Programar limpieza con pg_cron (habilitar la extensión en el dashboard)
-- select cron.schedule('liberar-slots', '* * * * *', 'select public.fn_liberar_slots_expirados()');

-- Helper: rol del usuario autenticado (evita recursión en políticas RLS)
create or replace function public.fn_mi_rol()
returns rol_usuario
language sql stable
security definer
set search_path = public
as $$
  select rol from usuarios where id = auth.uid();
$$;

create or replace function public.fn_mi_barberia()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select barberia_id from usuarios where id = auth.uid();
$$;

create or replace function public.fn_mi_barbero_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select id from barberos where usuario_id = auth.uid();
$$;

-- Trigger: crear perfil automáticamente al registrarse en auth
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, email, rol)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
          new.email,
          coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'cliente'));
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.barberias            enable row level security;
alter table public.usuarios            enable row level security;
alter table public.barberos             enable row level security;
alter table public.horarios_barberos    enable row level security;
alter table public.citas               enable row level security;
alter table public.pagos               enable row level security;
alter table public.fichas         enable row level security;
alter table public.recompensas_config  enable row level security;
alter table public.historial_fidelidad enable row level security;

-- --- USUARIOS ---------------------------------------------------------------
create policy "usuarios: leer propio perfil"
  on public.usuarios for select
  using (id = auth.uid());

create policy "usuarios: actualizar propio perfil"
  on public.usuarios for update
  using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from usuarios where id = auth.uid()));

create policy "usuarios: admin lee usuarios de su barberia"
  on public.usuarios for select
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());

-- --- BARBERIAS ---------------------------------------------------------------
create policy "barberias: lectura publica de datos basicos"
  on public.barberias for select
  using (true);   -- el directorio público necesita nombre/slug/logo

create policy "barberias: admin actualiza su barberia"
  on public.barberias for update
  using (fn_mi_rol() = 'admin_barberia' and id = fn_mi_barberia());

-- --- BARBEROS ----------------------------------------------------------------
-- Lectura pública SOLO vía vista (sin tokens); la tabla queda restringida.
create policy "barberos: barbero lee su propio registro"
  on public.barberos for select
  using (usuario_id = auth.uid());

create policy "barberos: barbero actualiza su registro"
  on public.barberos for update
  using (usuario_id = auth.uid());

create policy "barberos: admin gestiona barberos de su barberia"
  on public.barberos for all
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia())
  with check (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());

-- Vista pública segura para el directorio de clientes (sin tokens OAuth)
create view public.directorio_barberos
with (security_invoker = off) as
  select m.id, m.barberia_id, m.especialidad, m.biografia, m.precio_servicio,
         m.duracion_cita_min, m.acepta_domicilio,
         u.nombre, u.apellidos, u.avatar_url
    from public.barberos m
    join public.usuarios u on u.id = m.usuario_id
   where m.activo;

grant select on public.directorio_barberos to anon, authenticated;

-- --- HORARIOS ---------------------------------------------------------------
create policy "horarios: lectura publica"
  on public.horarios_barberos for select
  using (true);   -- necesario para mostrar disponibilidad a clientes

create policy "horarios: barbero gestiona los suyos"
  on public.horarios_barberos for all
  using (barbero_id = fn_mi_barbero_id())
  with check (barbero_id = fn_mi_barbero_id());

create policy "horarios: admin gestiona los de su barberia"
  on public.horarios_barberos for all
  using (fn_mi_rol() = 'admin_barberia'
         and barbero_id in (select id from barberos where barberia_id = fn_mi_barberia()));

-- --- CITAS ------------------------------------------------------------------
create policy "citas: cliente lee sus citas"
  on public.citas for select
  using (cliente_id = auth.uid());

create policy "citas: barbero lee SOLO sus citas"
  on public.citas for select
  using (barbero_id = fn_mi_barbero_id());

create policy "citas: barbero actualiza estado de sus citas"
  on public.citas for update
  using (barbero_id = fn_mi_barbero_id());

create policy "citas: admin lee SOLO citas de su barberia"
  on public.citas for select
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());

create policy "citas: cliente cancela su cita"
  on public.citas for update
  using (cliente_id = auth.uid())
  with check (estado in ('cancelada'));

-- NOTA: no hay política INSERT en citas. Toda creación pasa por
-- fn_bloquear_slot() (security definer), que aplica OTP + anti-hoarding.

-- --- PAGOS --------------------------------------------------------------
create policy "pagos: cliente lee sus pagos"
  on public.pagos for select
  using (cliente_id = auth.uid());

create policy "pagos: admin lee pagos de su barberia"
  on public.pagos for select
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());
-- Escritura de pagos: solo service_role (webhooks de Stripe), sin política.

-- --- FICHAS ----------------------------------------------------------
create policy "fichas: cliente lee su ficha"
  on public.fichas for select
  using (cliente_id = auth.uid());

create policy "fichas: barbero gestiona fichas de sus clientes"
  on public.fichas for all
  using (barbero_id = fn_mi_barbero_id())
  with check (barbero_id = fn_mi_barbero_id() and barberia_id = fn_mi_barberia());

-- --- FIDELIZACIÓN -----------------------------------------------------------
create policy "fidelidad: cliente lee su historial"
  on public.historial_fidelidad for select
  using (cliente_id = auth.uid());

create policy "fidelidad: admin lee historial de su barberia"
  on public.historial_fidelidad for select
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());

create policy "recompensas: lectura por miembros y clientes de la barberia"
  on public.recompensas_config for select
  using (true);

create policy "recompensas: admin configura las de su barberia"
  on public.recompensas_config for all
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia())
  with check (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());

-- ============================================================================
-- 6. REALTIME (disponibilidad en vivo para el nodo cliente)
-- ============================================================================
alter publication supabase_realtime add table public.citas;
