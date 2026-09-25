-- ============================================================================
-- Barber OS — Migración 00002: pago en efectivo
-- Agrega la opción de pagar el servicio en efectivo en la barbería, además
-- del pago con tarjeta vía Stripe.
-- ============================================================================

create type metodo_pago as enum ('tarjeta', 'efectivo');

alter table public.citas
  add column metodo_pago metodo_pago not null default 'tarjeta';

alter table public.pagos
  add column metodo_pago metodo_pago not null default 'tarjeta';

-- fn_bloquear_slot: ahora recibe el método de pago elegido por el cliente
-- y crea de una vez el registro en `pagos` (antes nada lo insertaba; solo
-- el webhook de Stripe lo actualizaba).
create or replace function public.fn_bloquear_slot(
  p_barbero_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_modalidad modalidad_cita default 'presencial',
  p_metodo_pago metodo_pago default 'tarjeta'
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
                     modalidad, estado, precio, bloqueo_expira_en, metodo_pago)
  values (v_barbero.barberia_id, p_barbero_id, auth.uid(), p_inicio, p_fin,
          p_modalidad, 'bloqueada', v_barbero.precio_servicio,
          now() + interval '10 minutes', p_metodo_pago)
  returning id into v_cita_id;

  insert into pagos (cita_id, barberia_id, cliente_id, monto, metodo_pago)
  values (v_cita_id, v_barbero.barberia_id, auth.uid(), v_barbero.precio_servicio, p_metodo_pago);

  return v_cita_id;
end;
$$;

-- fn_confirmar_pago_efectivo: el barbero o el administrador de la barbería
-- confirman en recepción que el cliente ya pagó en efectivo. Hace lo mismo
-- que el webhook de Stripe hace para tarjeta, pero disparado manualmente.
create or replace function public.fn_confirmar_pago_efectivo(p_cita_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cita citas%rowtype;
begin
  select * into v_cita from citas where id = p_cita_id;
  if not found then
    raise exception 'Cita no encontrada';
  end if;

  if v_cita.barbero_id <> fn_mi_barbero_id()
     and not (fn_mi_rol() = 'admin_barberia' and v_cita.barberia_id = fn_mi_barberia())
  then
    raise exception 'No autorizado';
  end if;

  update pagos
     set estado = 'pagado', pagado_en = now()
   where cita_id = p_cita_id
     and metodo_pago = 'efectivo';

  update citas
     set estado = 'confirmada', bloqueo_expira_en = null
   where id = p_cita_id
     and estado in ('bloqueada', 'pendiente_pago');
end;
$$;
