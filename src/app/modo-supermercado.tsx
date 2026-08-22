import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import ModoSupermercadoScreen from '../../screens/ModoSupermercadoScreen';
import type { TablesInsert } from '../../types/database.types';

export default function ModoSupermercadoTab() {
  const { session } = useAuth();
  const [listaId, setListaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarListaActiva = useCallback(async () => {
    const { data } = await supabase
      .from('listas_compra')
      .select('id')
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setListaId((data as { id: string } | null)?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    buscarListaActiva();
  }, [buscarListaActiva]);

  // MVP manual: hasta que exista la auto-generación de Fase 3 (Edge
  // Function programada), la lista se arma acá mismo con lo que ya está
  // en rojo/amarillo — mismo criterio que va a usar esa función después.
  const crearListaConStockBajo = async () => {
    if (!session) return;
    setError(null);
    setCreando(true);

    const { data: itemsBajos, error: errorInventario } = await supabase
      .from('inventario_hogar')
      .select('producto_id, cantidad_actual, stock_minimo')
      .in('estado_stock', ['rojo', 'amarillo']);

    if (errorInventario) {
      setError(errorInventario.message);
      setCreando(false);
      return;
    }

    const nuevaLista: TablesInsert<'listas_compra'> = { user_id: session.user.id };

    const { data: lista, error: errorLista } = await supabase
      .from('listas_compra')
      .insert(nuevaLista)
      .select('id')
      .single();

    if (errorLista || !lista) {
      setError(errorLista?.message ?? 'No se pudo crear la lista.');
      setCreando(false);
      return;
    }

    if (itemsBajos && itemsBajos.length > 0) {
      const detalle: TablesInsert<'detalle_lista'>[] = itemsBajos.map((item) => ({
        lista_id: lista.id,
        producto_id: item.producto_id,
        // Comprar lo que falta para volver al mínimo, al menos 1 unidad.
        cantidad_solicitada: Math.max(item.stock_minimo - item.cantidad_actual, 1),
      }));

      const { error: errorDetalle } = await supabase.from('detalle_lista').insert(detalle);

      if (errorDetalle) {
        setError(errorDetalle.message);
        setCreando(false);
        return;
      }
    }

    setCreando(false);
    setListaId(lista.id);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!listaId) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.mensaje}>No hay una lista de compras activa todavía.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.boton, creando && styles.botonDisabled]}
            onPress={crearListaConStockBajo}
            disabled={creando}
          >
            {creando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonTexto}>Crear lista de compras</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ModoSupermercadoScreen listaId={listaId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  mensaje: { textAlign: 'center', color: '#6B7280', fontSize: 15 },
  error: { color: '#E5484D', textAlign: 'center' },
  boton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
