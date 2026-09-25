-- ============================================================================
-- 00004 · Estado compartido de la app y endurecimiento de Auth
--
-- Los paneles trabajan sobre colecciones (citas, barberos, clientes...) que
-- antes vivían en el navegador. Ahora se guardan aquí, una fila por colección,
-- y sólo el servidor las toca: la tabla no tiene políticas, así que ni `anon`
-- ni `authenticated` pueden leerla o escribirla. Los permisos por rol los
-- aplica la API de Next (/api/datos) con la llave service_role.
-- ============================================================================

create table public.estado_app (
  clave          text primary key,
  valor          jsonb not null,
  version        bigint not null default 1,
  actualizado_en timestamptz not null default now()
);

alter table public.estado_app enable row level security;
revoke all on public.estado_app from anon, authenticated;

-- Guarda varias colecciones de una vez, sólo si nadie las cambió desde que se
-- leyeron (control optimista). Devuelve false ante un conflicto y el servidor
-- reintenta con los datos frescos.
create or replace function public.fn_guardar_estado(p_cambios jsonb, p_versiones jsonb)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  k text;
  v jsonb;
  actual bigint;
begin
  for k in select jsonb_object_keys(p_cambios) loop
    select version into actual from estado_app where clave = k for update;
    if coalesce(actual, 0) <> coalesce((p_versiones->>k)::bigint, 0) then
      return false;
    end if;
  end loop;

  for k, v in select * from jsonb_each(p_cambios) loop
    insert into estado_app (clave, valor) values (k, v)
    on conflict (clave) do update
      set valor = excluded.valor,
          version = estado_app.version + 1,
          actualizado_en = now();
  end loop;
  return true;
end;
$$;

revoke execute on function public.fn_guardar_estado(jsonb, jsonb) from public, anon, authenticated;

-- El rol ya no se toma de user_metadata (lo edita el propio usuario): todo
-- registro nuevo entra como cliente y el rol real vive en app_metadata.
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, email, rol)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',
                   new.raw_user_meta_data->>'nombre',
                   split_part(new.email, '@', 1)),
          new.email,
          'cliente');
  return new;
end;
$$;

-- Funciones internas que no deben poder llamarse por la API REST sin sesión.
revoke execute on function public.fn_handle_new_user()          from public, anon, authenticated;
revoke execute on function public.fn_liberar_slots_expirados()  from public, anon, authenticated;
revoke execute on function public.fn_emitir_tarjeta()           from public, anon, authenticated;
revoke execute on function public.fn_acumular_fidelidad()       from public, anon, authenticated;
revoke execute on function public.fn_confirmar_pago_efectivo(uuid) from public, anon;
revoke execute on function public.fn_ajustar_sellos(uuid, int)     from public, anon;
