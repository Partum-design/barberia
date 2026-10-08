-- ============================================================================
-- 00006 · Menú impreso y redes de Barbería CortMart (octubre 2026)
--
-- Agrega los servicios del menú que aún no estén en el catálogo (por nombre)
-- y llena WhatsApp, Instagram, TikTok, eslogan y año de fundación sólo si el
-- administrador los dejó vacíos. Se puede correr más de una vez sin duplicar.
-- ============================================================================

insert into public.estado_app (clave, valor)
values ('servicios', '[]'::jsonb)
on conflict (clave) do nothing;

with menu (orden, nombre, categoria, descripcion, desde, precio, duracion) as (
  values
    (1,  'Corte de adulto',   'Corte',    null,                                false, 200, 40),
    (2,  'Corte Junior',      'Corte',    null,                                false, 180, 30),
    (3,  'Diseño de grecas',  'Corte',    null,                                false,  60, 15),
    (4,  'Afeitado Clásico',  'Afeitado', null,                                false, 200, 30),
    (5,  'Afeitado CortMart', 'Afeitado', null,                                false, 300, 45),
    (6,  'Bigote',            'Afeitado', null,                                false,  60, 15),
    (7,  'Facial',            'Rostro',   null,                                false, 200, 30),
    (8,  'Ceja (Delineado)',  'Rostro',   null,                                false,  50, 10),
    (9,  'Ceja (Planchado)',  'Rostro',   null,                                false, 150, 30),
    (10, 'Mascarilla Negra',  'Rostro',   null,                                false, 100, 20),
    (11, 'Paquete Facial',    'Paquete',  'Corte y facial',                    false, 300, 70),
    (12, 'Paquete Clásico',   'Paquete',  'Corte y afeitado clásico',          false, 300, 70),
    (13, 'Paquete CortMart',  'Paquete',  'Corte y afeitado CortMart',         false, 400, 85),
    (14, 'Paquete Premium',   'Paquete',  'Corte, afeitado CortMart y facial', false, 500, 115),
    (15, 'Crioterapia',       'Especial', null,                                true,  250, 40),
    (16, 'Box Braids',        'Especial', null,                                true,  200, 90)
),
actual as (
  select valor from public.estado_app where clave = 'servicios'
),
faltantes as (
  select coalesce(jsonb_agg(
           jsonb_strip_nulls(jsonb_build_object(
             'id',           'srv-' || substr(md5(m.nombre), 1, 8),
             'nombre',       m.nombre,
             'categoria',    m.categoria,
             'descripcion',  m.descripcion,
             'desde',        case when m.desde then true end,
             'precio',       m.precio,
             'duracion_min', m.duracion,
             'comision_pct', 45,
             'activo',       true
           )) order by m.orden), '[]'::jsonb) as nuevos
  from menu m, actual a
  where not exists (
    select 1 from jsonb_array_elements(a.valor) s
    where lower(trim(s->>'nombre')) = lower(m.nombre)
  )
)
update public.estado_app e
set valor = e.valor || f.nuevos,
    version = e.version + 1
from faltantes f
where e.clave = 'servicios' and jsonb_array_length(f.nuevos) > 0;

update public.estado_app
set valor = valor
  || case when coalesce(valor->>'whatsapp', '') = '' then '{"whatsapp": "56 4338 8834"}'::jsonb else '{}'::jsonb end
  || case when coalesce(valor->>'instagram', '') = '' then '{"instagram": "barberiacortmart"}'::jsonb else '{}'::jsonb end
  || case when coalesce(valor->>'tiktok', '') = '' then '{"tiktok": "barberiacortmart"}'::jsonb else '{}'::jsonb end
  || case when coalesce(valor->>'telefono', '') = '' then '{"telefono": "56 4338 8834"}'::jsonb else '{}'::jsonb end
  || case when coalesce(valor->>'anio_fundacion', '') = '' then '{"anio_fundacion": "2001"}'::jsonb else '{}'::jsonb end
  || case when coalesce(valor->>'eslogan', '') in ('', 'Cortes con detalle, atención de lujo')
          then '{"eslogan": "Estilo que habla por ti"}'::jsonb else '{}'::jsonb end,
    version = version + 1
where clave = 'barberia';
