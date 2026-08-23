import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GastoMensual, MejorSupermercadoProducto, TendenciaPrecio } from '../types/database.types';

export interface TendenciaProducto {
  producto_id: string;
  producto_nombre: string;
  precio_actual: number;
  precio_anterior: number;
}

// Compara precio_unitario a precio_unitario (el monto antes del
// descuento), no precio_final: una compra con 2x1 seguida de una sin
// descuento se vería como un aumento enorme aunque el producto no haya
// cambiado de precio. Si un producto solo tiene una compra registrada,
// no hay "anterior" con qué comparar — no se muestra evolución para ese caso.
function calcularTendencias(filas: TendenciaPrecio[]): TendenciaProducto[] {
  const porProducto = new Map<string, TendenciaPrecio[]>();

  for (const fila of filas) {
    const lista = porProducto.get(fila.producto_id) ?? [];
    lista.push(fila);
    porProducto.set(fila.producto_id, lista);
  }

  const tendencias: TendenciaProducto[] = [];

  for (const historial of porProducto.values()) {
    if (historial.length < 2) continue;

    // vista_tendencia_precio ya viene ordenada por fecha_registro asc
    const ultimo = historial[historial.length - 1];
    const anterior = historial[historial.length - 2];

    tendencias.push({
      producto_id: ultimo.producto_id,
      producto_nombre: ultimo.producto_nombre,
      precio_actual: ultimo.precio_unitario,
      precio_anterior: anterior.precio_unitario,
    });
  }

  return tendencias;
}

export function useDashboardAhorro() {
  const [gastoMensual, setGastoMensual] = useState<GastoMensual[]>([]);
  const [mejorSupermercado, setMejorSupermercado] = useState<MejorSupermercadoProducto[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const yaCargoUnaVez = useRef(false);

  const fetchDashboard = useCallback(async () => {
    if (!yaCargoUnaVez.current) setLoading(true);

    const [gastoRes, supermercadoRes, tendenciaRes] = await Promise.all([
      supabase
        .from('vista_gasto_mensual')
        .select('*')
        .order('mes', { ascending: false }),
      supabase.from('vista_mejor_supermercado_producto').select('*'),
      supabase.from('vista_tendencia_precio').select('*'),
    ]);

    const primerError =
      gastoRes.error?.message ?? supermercadoRes.error?.message ?? tendenciaRes.error?.message;

    if (primerError) {
      setError(primerError);
      setLoading(false);
      return;
    }

    setError(null);
    setGastoMensual((gastoRes.data ?? []) as GastoMensual[]);
    setMejorSupermercado((supermercadoRes.data ?? []) as MejorSupermercadoProducto[]);
    setTendencias(calcularTendencias((tendenciaRes.data ?? []) as TendenciaPrecio[]));
    setLoading(false);
    yaCargoUnaVez.current = true;
  }, []);

  // useFocusEffect (no un simple useEffect en el mount) porque las tabs de
  // Expo Router no desmontan sus pantallas al cambiar de tab — sin esto,
  // comprar algo en Modo Supermercado y volver a Historial seguía
  // mostrando los datos de la primera vez que se abrió la pestaña.
  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  return { gastoMensual, mejorSupermercado, tendencias, loading, error, refetch: fetchDashboard };
}
