import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import ModoSupermercadoScreen from '../../screens/ModoSupermercadoScreen';

export default function ModoSupermercadoTab() {
  const [listaId, setListaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    supabase
      .from('listas_compra')
      .select('id')
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) {
          setListaId((data as { id: string } | null)?.id ?? null);
          setLoading(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensaje: { textAlign: 'center', color: '#6B7280', fontSize: 15 },
});
