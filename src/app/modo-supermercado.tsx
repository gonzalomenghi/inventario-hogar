import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import ModoSupermercadoScreen from '../../screens/ModoSupermercadoScreen';

export default function ModoSupermercadoTab() {
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

  // fn_generar_lista_compra (backend): crea la lista con lo que ya está
  // en rojo/amarillo, o devuelve la activa existente si ya hay una. La
  // misma función corre sola todos los días vía pg_cron (Fase 3); esto
  // es para generarla/refrescarla al toque, sin esperar al schedule.
  const crearListaConStockBajo = async () => {
    setError(null);
    setCreando(true);

    const { data: listaIdNueva, error: errorRpc } = await supabase.rpc(
      'fn_generar_lista_compra'
    );

    setCreando(false);

    if (errorRpc || !listaIdNueva) {
      setError(errorRpc?.message ?? 'No se pudo crear la lista.');
      return;
    }

    setListaId(listaIdNueva);
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
  mensaje: { textAlign: 'center', color: Colors.textSecondary, fontSize: 15 },
  error: { color: Colors.error, textAlign: 'center' },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
