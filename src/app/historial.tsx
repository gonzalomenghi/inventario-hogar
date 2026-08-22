import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import DashboardAhorroScreen from '../../screens/DashboardAhorroScreen';

export default function HistorialTab() {
  const { session } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <DashboardAhorroScreen />
      </View>

      {session && (
        <View style={styles.cuenta}>
          <Text style={styles.email}>{session.user.email}</Text>
          <Pressable style={styles.boton} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.botonTexto}>Cerrar sesión</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cuenta: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
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
