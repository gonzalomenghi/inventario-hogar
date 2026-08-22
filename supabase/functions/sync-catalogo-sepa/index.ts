// Edge Function: sync-catalogo-sepa
//
// TODO — no implementada todavía. Contrato esperado:
//
// 1. Descargar el dataset SEPA/Precios Claros vigente desde
//    datos.produccion.gob.ar/dataset/sepa-precios (el dataset se publica
//    como CSV/ZIP por sucursal; hay que decidir si se toma la agregación
//    nacional o se itera por cadena — Carrefour, Coto, Día, Jumbo, etc.).
// 2. Parsear cada fila a { codigo_barras (EAN), nombre, marca }.
// 3. Mapear el rubro/categoría del dataset a nuestro enum
//    categoria_producto ('alimentos' | 'higiene' | 'limpieza') — el
//    dataset SEPA no usa las mismas categorías, así que hace falta una
//    tabla de mapeo o heurística.
// 4. Upsert en catalogo_sepa_ref por codigo_barras (PK), actualizando
//    ultima_actualizacion = now() en cada fila tocada.
// 5. Usar la service_role key (esta función corre server-side, bypassea
//    RLS) — nunca exponer esa key al cliente.
//
// Disparo periódico (a definir cuando se implemente el punto 1-4):
//   - Opción A: pg_cron + pg_net dentro de la propia base de Supabase,
//     invocando esta función por HTTP en un schedule (ej. diario 03:00).
//     Requiere habilitar ambas extensiones en una migración aparte.
//   - Opción B: cron externo (GitHub Actions con `schedule:`) pegándole
//     al endpoint de la función vía POST con el service_role key en
//     el header Authorization, guardado como secret del repo.
//
// Ver buscar_producto_similar() en
// supabase/migrations/20260822161157_matching_productos.sql para cómo
// se consume esta tabla desde el autocompletado.

Deno.serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({ error: 'sync-catalogo-sepa: no implementada todavía' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
});
