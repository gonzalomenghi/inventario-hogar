import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import DashboardAhorroScreen from '../../screens/DashboardAhorroScreen';
import EscanearTicketModal from '../../screens/EscanearTicketModal';

export default function HistorialTab() {
  const { session } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  // Fuerza el remount del dashboard después de guardar precios nuevos,
  // para que useDashboardAhorro vuelva a hacer fetch (no tiene Realtime).
  const [refrescarKey, setRefrescarKey] = useState(0);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <DashboardAhorroScreen key={refrescarKey} />

        <Pressable
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Escanear ticket"
        >
          <Text style={styles.fabTexto}>📷</Text>
        </Pressable>

        <EscanearTicketModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onGuardado={() => setRefrescarKey((k) => k + 1)}
        />
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabTexto: { fontSize: 24 },
});
