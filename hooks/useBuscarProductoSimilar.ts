import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CategoriaProducto } from '../types/database.types';

export interface ResultadoBusquedaProducto {
  origen: 'propio' | 'sepa';
  // id en productos_base cuando origen === 'propio'; null cuando 'sepa'
  // (todavía no existe en el catálogo propio, hay que crearlo si se elige).
  id: string | null;
  codigo_barras: string | null;
  nombre: string;
  marca: string | null;
  categoria: CategoriaProducto;
  unidad_medida: string | null;
  similitud: number;
}

const LARGO_MINIMO = 2;
const DEBOUNCE_MS = 300;

// Búsqueda difusa (pg_trgm + unaccent) contra productos_base propio y,
// si no hay nada bueno ahí, contra el catálogo de referencia SEPA. Ver
// buscar_producto_similar() en supabase/migrations/.
export function useBuscarProductoSimilar(query: string) {
  const [resultados, setResultados] = useState<ResultadoBusquedaProducto[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const texto = query.trim();

    if (texto.length < LARGO_MINIMO) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    let cancelado = false;
    setBuscando(true);

    const timeout = setTimeout(async () => {
      const { data, error } = await supabase.rpc('buscar_producto_similar', {
        texto_busqueda: texto,
        limite: 8,
      });

      if (!cancelado) {
        setResultados(error || !data ? [] : (data as ResultadoBusquedaProducto[]));
        setBuscando(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return { resultados, buscando };
}
