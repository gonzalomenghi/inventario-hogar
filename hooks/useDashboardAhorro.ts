import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GastoMensual, MejorSupermercadoProducto, TendenciaPrecio } from '../types/database.types';

export interface TendenciaProducto {
  producto_id: string;
  producto_nombre: string;
  precio_actual: number;
  precio_anterior: number | null;
}

function calcularTendencias(filas: TendenciaPrecio[]): TendenciaProducto[] {
  const porProducto = new Map<string, TendenciaPrecio[]>();

  for (const fila of filas) {
    const lista = porProducto.get(fila.producto_id) ?? [];
    lista.push(fila);
    porProducto.set(fila.producto_id, lista);
  }

  return Array.from(porProducto.values()).map((historial) => {
    // vista_tendencia_precio ya viene ordenada por fecha_registro asc
    const ultimo = historial[historial.length - 1];
    const anterior = historial.length > 1 ? historial[historial.length - 2] : null;

    return {
      producto_id: ultimo.producto_id,
      producto_nombre: ultimo.producto_nombre,
      precio_actual: ultimo.precio_final,
      precio_anterior: anterior?.precio_final ?? null,
    };
  });
}

export function useDashboardAhorro() {
  const [gastoMensual, setGastoMensual] = useState<GastoMensual[]>([]);
  const [mejorSupermercado, setMejorSupermercado] = useState<MejorSupermercadoProducto[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const [gastoRes, supermercadoRes, tendenciaRes] = await Promise.all([
        supabase
          .from('vista_gasto_mensual')
          .select('*')
          .order('mes', { ascending: false }),
        supabase.from('vista_mejor_supermercado_producto').select('*'),
        supabase.from('vista_tendencia_precio').select('*'),
      ]);

      if (cancelado) return;

      const primerError =
        gastoRes.error?.message ?? supermercadoRes.error?.message ?? tendenciaRes.error?.message;

      if (primerError) {
        setError(primerError);
        setLoading(false);
        return;
      }

      setGastoMensual((gastoRes.data ?? []) as GastoMensual[]);
      setMejorSupermercado((supermercadoRes.data ?? []) as MejorSupermercadoProducto[]);
      setTendencias(calcularTendencias((tendenciaRes.data ?? []) as TendenciaPrecio[]));
      setLoading(false);
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return { gastoMensual, mejorSupermercado, tendencias, loading, error };
}
