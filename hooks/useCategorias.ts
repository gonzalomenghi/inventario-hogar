import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Categoria, TablesInsert } from '../types/database.types';

export function useCategorias() {
  // Nombre de canal único por instancia: CategoriaPicker y InventarioScreen
  // montan cada uno su propio useCategorias() al mismo tiempo, y
  // supabase-js tira "cannot add postgres_changes callbacks... after
  // subscribe()" si dos instancias intentan reusar el mismo nombre de canal.
  const channelId = useId();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategorias = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setCategorias((data ?? []) as Categoria[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategorias();

    // Realtime: AgregarProductoModal y las pantallas que usan el picker
    // montan cada una su propia instancia de este hook (no hay estado
    // global), así que sin esto crear/editar una categoría en un lado
    // no se reflejaría en el otro sin cerrar y reabrir.
    const channel = supabase
      .channel(`categorias_changes_${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categorias' },
        () => fetchCategorias()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCategorias]);

  const crearCategoria = useCallback(
    async (nombre: string, icono: string) => {
      const nuevaCategoria: TablesInsert<'categorias'> = { nombre: nombre.trim(), icono: icono.trim() };
      const { data, error } = await supabase
        .from('categorias')
        .insert(nuevaCategoria)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Nombre duplicado: puede ser un choque real (otro usuario ya la
          // creó) o un doble submit del mismo formulario. En vez de solo
          // fallar, buscamos la que ya existe y la devolvemos como si se
          // hubiera creado — más robusto que forzar al usuario a reintentar
          // con otro nombre.
          const { data: existente } = await supabase
            .from('categorias')
            .select('*')
            .ilike('nombre', nuevaCategoria.nombre)
            .maybeSingle();
          if (existente) {
            setCategorias((prev) =>
              prev.some((c) => c.id === existente.id) ? prev : [...prev, existente as Categoria]
            );
            return existente as Categoria;
          }
        }
        setError(error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : error.message);
        return null;
      }

      // Push local optimista: no depender del round-trip de Realtime para
      // que la categoría recién creada aparezca en la MISMA instancia del
      // picker que la creó (Realtime sigue haciendo falta para que otras
      // instancias montadas en paralelo se enteren).
      setCategorias((prev) => [...prev, data as Categoria]);
      return data as Categoria;
    },
    []
  );

  const editarCategoria = useCallback(
    async (id: string, nombre: string, icono: string) => {
      setCategorias((prev) =>
        prev.map((c) => (c.id === id ? { ...c, nombre: nombre.trim(), icono: icono.trim() } : c))
      );

      const { error } = await supabase
        .from('categorias')
        .update({ nombre: nombre.trim(), icono: icono.trim() })
        .eq('id', id);

      if (error) {
        setError(error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : error.message);
        fetchCategorias();
        return false;
      }
      return true;
    },
    [fetchCategorias]
  );

  return { categorias, loading, error, crearCategoria, editarCategoria };
}
