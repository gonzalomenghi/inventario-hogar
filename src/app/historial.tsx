import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function HistorialTab() {
  const { session } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.centered}>
        <Text style={styles.mensaje}>
          El historial de precios y gasto llega en una fase más adelante.
        </Text>

        {session && (
          <View style={styles.cuenta}>
            <Text style={styles.email}>{session.user.email}</Text>
            <Pressable style={styles.boton} onPress={() => supabase.auth.signOut()}>
              <Text style={styles.botonTexto}>Cerrar sesión</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensaje: { textAlign: 'center', color: '#6B7280', fontSize: 15 },
  cuenta: { marginTop: 32, alignItems: 'center', gap: 8 },
  email: { color: '#6B7280', fontSize: 13 },
  boton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  botonTexto: { color: '#E5484D', fontWeight: '600' },
});
