import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { InventarioItem } from '../types/database.types';

export function useInventario() {
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventario = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('inventario_hogar')
      .select('*, producto:productos_base(*)')
      .order('estado_stock', { ascending: true }) // rojo/amarillo primero (orden alfabético lo aproxima)
      .order('updated_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setItems((data ?? []) as InventarioItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInventario();

    // Realtime: si el usuario edita desde otro dispositivo, se refleja al toque
    const channel = supabase
      .channel('inventario_hogar_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_hogar' },
        () => fetchInventario()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventario]);

  // Control rápido +/-: actualización optimista en UI, luego confirma contra la DB
  const ajustarCantidad = useCallback(
    async (itemId: string, delta: number) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, cantidad_actual: Math.max(0, it.cantidad_actual + delta) }
            : it
        )
      );

      const item = items.find((it) => it.id === itemId);
      if (!item) return;

      const nuevaCantidad = Math.max(0, item.cantidad_actual + delta);

      const { error } = await supabase
        .from('inventario_hogar')
        .update({ cantidad_actual: nuevaCantidad })
        .eq('id', itemId);

      if (error) {
        // Revertir en caso de error de red/servidor
        setError(error.message);
        fetchInventario();
      }
    },
    [items, fetchInventario]
  );

  return { items, loading, error, ajustarCantidad, refetch: fetchInventario };
}
