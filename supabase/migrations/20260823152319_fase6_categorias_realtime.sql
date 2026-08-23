-- ============================================================
-- Habilitar Realtime (postgres_changes) para categorias e
-- inventario_hogar.
--
-- Encontrado probando el picker de categorías contra una base local:
-- ninguna tabla estaba en la publicación supabase_realtime (ni acá ni
-- en producción -- confirmado con
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
-- devolviendo 0 filas en ambas). La suscripción Realtime de
-- hooks/useInventario.ts (el comentario "si el usuario edita desde
-- otro dispositivo, se refleja al toque") nunca hizo nada en la
-- práctica -- quedó enmascarado porque las actualizaciones optimistas
-- locales ya hacen sentir la UI instantánea sin depender de esto.
-- Se agrega categorias porque hooks/useCategorias.ts (Fase 6) sí
-- depende de esto para sincronizar entre instancias montadas en
-- paralelo (CategoriaPicker dentro de un modal + la sección de
-- InventarioScreen), y de paso se corrige inventario_hogar ya que es
-- el mismo bug y el fix es de una línea.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventario_hogar;
