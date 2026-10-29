import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sesionDePeticion } from "@/lib/datos/servidor";

export const dynamic = "force-dynamic";

const BUCKET = "productos";
const MAX_BYTES = 2 * 1024 * 1024;
const TIPOS: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/**
 * POST /api/productos/imagen — sube la foto de un producto de la tienda.
 * Sólo el administrador. El navegador ya la manda reducida (WebP ~900 px);
 * aquí se valida tipo y tamaño y se guarda en un bucket público de Storage.
 */
export async function POST(req: NextRequest) {
  const sesion = await sesionDePeticion();
  if (sesion?.rol !== "admin") return NextResponse.json({ error: "Sólo el administrador sube fotos." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
  const ext = TIPOS[archivo.type];
  if (!ext) return NextResponse.json({ error: "Usa una imagen JPG, PNG o WebP." }, { status: 400 });
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 2 MB." }, { status: 400 });

  try {
    const supabase = createAdminClient();
    // El bucket se crea la primera vez: así no hace falta una migración.
    const { data: bucket } = await supabase.storage.getBucket(BUCKET);
    if (!bucket) {
      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: Object.keys(TIPOS),
      });
      if (error && !/already exists/i.test(error.message)) throw error;
    }
    const ruta = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
      contentType: archivo.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("No se pudo subir la foto del producto", err);
    return NextResponse.json({ error: "No se pudo subir la foto. Intenta de nuevo o pega un enlace." }, { status: 500 });
  }
}
