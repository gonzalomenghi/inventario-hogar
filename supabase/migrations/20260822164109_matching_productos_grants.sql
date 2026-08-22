-- ============================================================
-- catalogo_sepa_ref: faltaban los GRANT a nivel tabla.
--
-- RLS controla acceso por fila, pero Postgres exige el privilegio a
-- nivel tabla primero (GRANT), independiente de las policies. Sin
-- esto, cualquier select desde anon/authenticated tira
-- "permission denied for table catalogo_sepa_ref" (42501), aunque la
-- policy de lectura pública ya exista. El resto de las tablas del
-- schema (ver 20260821121349_remote_schema.sql) ya tienen este mismo
-- patrón de grants; a esta se le había pasado por alto.
--
-- Solo lectura para anon/authenticated: la tabla la escribe el
-- proceso de sync (service_role, bypassea RLS y grants igual).
-- ============================================================

GRANT SELECT ON TABLE public.catalogo_sepa_ref TO anon;
GRANT SELECT ON TABLE public.catalogo_sepa_ref TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLE public.catalogo_sepa_ref TO service_role;
