-- ============================================================================
-- Migración 00003: tarjetas de lealtad (con Google Wallet) y datos de portada
--
-- · `clientes` registra también a quien llega sin cuenta (alta en mostrador);
--   si más tarde crea cuenta, se enlaza por `usuario_id`.
-- · `tarjetas_lealtad`: una por cliente y barbería, con número propio para el
--   QR y el pase de Google Wallet. Los sellos de citas asistidas siguen
--   saliendo de `historial_fidelidad`; aquí sólo viven los de mostrador.
-- · `barberias` gana los campos que publica la portada del negocio.
-- ============================================================================

-- Portada del negocio ----------------------------------------------------------
alter table public.barberias
  add column if not exists eslogan        text,
  add column if not exists descripcion    text,
  add column if not exists mapa_url       text,
  add column if not exists whatsapp       text,
  add column if not exists email          text,
  add column if not exists instagram      text,
  add column if not exists facebook       text,
  add column if not exists tiktok         text,
  add column if not exists anio_fundacion smallint,
  -- {"lun":{"activo":true,"inicio":"10:00","fin":"20:00"}, ...}
  add column if not exists horario        jsonb not null default '{}'::jsonb;

-- Clientes -------------------------------------------------------------------
create table public.clientes (
  id           uuid primary key default gen_random_uuid(),
  barberia_id  uuid not null references public.barberias(id) on delete cascade,
  usuario_id   uuid references public.usuarios(id) on delete set null,
  nombre       text not null,
  telefono     text,
  email        text,
  creado_en    timestamptz not null default now(),
  unique (barberia_id, usuario_id)
);

create index idx_clientes_barberia on public.clientes (barberia_id);
create index idx_clientes_telefono on public.clientes (barberia_id, telefono);

-- Tarjetas de lealtad --------------------------------------------------------
create type estado_tarjeta as enum ('activa', 'suspendida');

create table public.tarjetas_lealtad (
  id                  uuid primary key default gen_random_uuid(),
  barberia_id         uuid not null references public.barberias(id) on delete cascade,
  cliente_id          uuid not null references public.clientes(id) on delete cascade,
  numero              text not null unique,
  sellos_extra        int not null default 0 check (sellos_extra >= 0),
  recompensas_canjeadas int not null default 0 check (recompensas_canjeadas >= 0),
  estado              estado_tarjeta not null default 'activa',
  wallet_object_id    text,                 -- <issuer>.<numero> en Google Wallet
  wallet_guardada_en  timestamptz,
  emitida_en          timestamptz not null default now(),
  unique (barberia_id, cliente_id)
);

create index idx_tarjetas_barberia on public.tarjetas_lealtad (barberia_id);

-- Número legible: LC-0000-0000, único en todo el sistema.
create or replace function public.fn_numero_tarjeta()
returns text
language plpgsql
as $$
declare
  v text;
begin
  loop
    v := 'LC-' || lpad((floor(random() * 10000))::int::text, 4, '0')
              || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from tarjetas_lealtad where numero = v);
  end loop;
  return v;
end;
$$;

alter table public.tarjetas_lealtad
  alter column numero set default public.fn_numero_tarjeta();

-- Todo cliente nuevo recibe su tarjeta al instante.
create or replace function public.fn_emitir_tarjeta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tarjetas_lealtad (barberia_id, cliente_id)
  values (new.barberia_id, new.id)
  on conflict (barberia_id, cliente_id) do nothing;
  return new;
end;
$$;

create trigger trg_emitir_tarjeta
  after insert on public.clientes
  for each row execute function public.fn_emitir_tarjeta();

-- Sello de mostrador (visita sin cita). Sólo personal de la barbería.
create or replace function public.fn_ajustar_sellos(p_tarjeta_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarjeta tarjetas_lealtad%rowtype;
begin
  select * into v_tarjeta from tarjetas_lealtad where id = p_tarjeta_id;
  if not found then
    raise exception 'Tarjeta no encontrada';
  end if;
  if v_tarjeta.barberia_id <> fn_mi_barberia()
     or fn_mi_rol() not in ('admin_barberia', 'barbero') then
    raise exception 'No autorizado';
  end if;
  if v_tarjeta.estado <> 'activa' then
    raise exception 'Tarjeta suspendida';
  end if;

  update tarjetas_lealtad
     set sellos_extra = greatest(0, sellos_extra + p_delta)
   where id = p_tarjeta_id
  returning sellos_extra into v_tarjeta.sellos_extra;

  return v_tarjeta.sellos_extra;
end;
$$;

-- RLS ------------------------------------------------------------------------
alter table public.clientes         enable row level security;
alter table public.tarjetas_lealtad enable row level security;

create policy "clientes: el cliente lee su registro"
  on public.clientes for select
  using (usuario_id = auth.uid());

create policy "clientes: personal de la barberia los gestiona"
  on public.clientes for all
  using (fn_mi_rol() in ('admin_barberia', 'barbero') and barberia_id = fn_mi_barberia())
  with check (fn_mi_rol() in ('admin_barberia', 'barbero') and barberia_id = fn_mi_barberia());

create policy "tarjetas: el cliente lee la suya"
  on public.tarjetas_lealtad for select
  using (cliente_id in (select id from clientes where usuario_id = auth.uid()));

create policy "tarjetas: personal de la barberia las lee"
  on public.tarjetas_lealtad for select
  using (fn_mi_rol() in ('admin_barberia', 'barbero') and barberia_id = fn_mi_barberia());

create policy "tarjetas: admin las gestiona"
  on public.tarjetas_lealtad for update
  using (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia())
  with check (fn_mi_rol() = 'admin_barberia' and barberia_id = fn_mi_barberia());
-- Los sellos del barbero pasan por fn_ajustar_sellos (security definer).
