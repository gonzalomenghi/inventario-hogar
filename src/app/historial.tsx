import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import DashboardAhorroScreen from '../../screens/DashboardAhorroScreen';
import EscanearTicketModal from '../../screens/EscanearTicketModal';

export default function HistorialTab() {
  const { session } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  // useDashboardAhorro ya refetchea solo al volver a esta tab (useFocusEffect),
  // pero escanear un ticket pasa por un modal sin salir de la ruta — no hay
  // refoco que dispare eso. Se fuerza el remount acá específicamente para ese caso.
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
    borderTopColor: Colors.backgroundMuted,
  },
  email: { color: Colors.textSecondary, fontSize: 13 },
  boton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  botonTexto: { color: Colors.error, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
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
