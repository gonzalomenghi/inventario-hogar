import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Supermercado, TablesInsert } from '../types/database.types';

// Sin Realtime a propósito: a diferencia de categorias (usado en varios
// pickers montados a la vez), acá el picker de supermercado solo se monta
// una instancia por vez, así que no hay nada que sincronizar entre
// instancias en paralelo.
export function useSupermercados() {
  const [supermercados, setSupermercados] = useState<Supermercado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSupermercados = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('supermercados')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setSupermercados((data ?? []) as Supermercado[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSupermercados();
  }, [fetchSupermercados]);

  // Busca por nombre exacto y devuelve el existente, o crea uno nuevo si
  // no hay match — mismo criterio que ya usaba EscanearTicketModal.tsx
  // inline, generalizado acá.
  const crearSupermercado = useCallback(
    async (nombre: string, direccion?: string) => {
      const nombreLimpio = nombre.trim();
      if (!nombreLimpio) return null;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('No hay sesión activa.');
        return null;
      }

      const { data: existente } = await supabase
        .from('supermercados')
        .select('*')
        .eq('nombre', nombreLimpio)
        .maybeSingle();

      if (existente) return existente as Supermercado;

      const nuevoSupermercado: TablesInsert<'supermercados'> = {
        user_id: user.id,
        nombre: nombreLimpio,
        direccion: direccion?.trim() || null,
      };

      const { data, error } = await supabase
        .from('supermercados')
        .insert(nuevoSupermercado)
        .select()
        .single();

      if (error) {
        setError(error.message);
        return null;
      }

      // Push local optimista: que aparezca en el mismo picker que lo creó
      // sin depender de nada más (no hay Realtime acá).
      setSupermercados((prev) => [...prev, data as Supermercado]);
      return data as Supermercado;
    },
    []
  );

  return { supermercados, loading, error, crearSupermercado };
}
