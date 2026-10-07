-- ============================================================================
-- 00005 · Datos iniciales de Barbería CortMart
--
-- Carga la ficha pública del negocio (Google Maps, octubre 2026) como punto
-- de partida del panel: nombre, dirección, teléfono, horario y textos de la
-- portada. Sólo inserta si la colección todavía no existe, así que nunca pisa
-- lo que el administrador ya haya capturado en Configuración.
--
-- También alinea public.usuarios.rol con el rol real (auth.users.app_metadata),
-- que es el que usa la app desde la migración 00004.
-- ============================================================================

insert into public.estado_app (clave, valor)
values (
  'barberia',
  jsonb_build_object(
    'nombre',          'Barbería CortMart',
    'eslogan',         'Cortes con detalle, atención de lujo',
    'descripcion',     'Somos la barbería de la colonia Industrial, en Gustavo A. Madero. Ladrillo, luz cálida y sillas listas para que salgas con el corte justo como lo quieres: con tiempo, con detalle y sin prisas.',
    'direccion',       'Av. Euzkaro 152, Industrial, Gustavo A. Madero, 07800 Ciudad de México, CDMX',
    'mapa_url',        'https://maps.app.goo.gl/kxM54X3zWtwRYZC89',
    'telefono',        '56 4338 8834',
    'whatsapp',        '',
    'email',           '',
    'instagram',       '',
    'facebook',        '',
    'tiktok',          '',
    'anio_fundacion',  '',
    'horario', jsonb_build_object(
      'lun', jsonb_build_object('activo', true, 'inicio', '12:00', 'fin', '20:00'),
      'mar', jsonb_build_object('activo', true, 'inicio', '12:00', 'fin', '20:00'),
      'mie', jsonb_build_object('activo', true, 'inicio', '12:00', 'fin', '20:00'),
      'jue', jsonb_build_object('activo', true, 'inicio', '12:00', 'fin', '20:00'),
      'vie', jsonb_build_object('activo', true, 'inicio', '12:00', 'fin', '20:00'),
      'sab', jsonb_build_object('activo', true, 'inicio', '10:00', 'fin', '18:00'),
      'dom', jsonb_build_object('activo', true, 'inicio', '10:00', 'fin', '18:00')
    )
  )
)
on conflict (clave) do nothing;

insert into public.estado_app (clave, valor)
values ('recompensas', '{"citas_requeridas": 5, "valor_descuento": 20}'::jsonb)
on conflict (clave) do nothing;

-- Rol de la tabla de perfiles = rol real de Auth ('admin' de la app es
-- 'admin_barberia' en el enum heredado de 00001).
update public.usuarios u
set rol = case a.raw_app_meta_data->>'rol'
            when 'admin' then 'admin_barberia'::rol_usuario
            when 'barbero' then 'barbero'::rol_usuario
            else 'cliente'::rol_usuario
          end
from auth.users a
where a.id = u.id
  and a.raw_app_meta_data->>'rol' in ('cliente', 'barbero', 'admin')
  and u.rol <> case a.raw_app_meta_data->>'rol'
                 when 'admin' then 'admin_barberia'::rol_usuario
                 when 'barbero' then 'barbero'::rol_usuario
                 else 'cliente'::rol_usuario
               end;
