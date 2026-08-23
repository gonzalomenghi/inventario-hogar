import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import DashboardAhorroScreen from '../../screens/DashboardAhorroScreen';
import EscanearTicketModal from '../../screens/EscanearTicketModal';
import PressableFeedback from '../../screens/PressableFeedback';

export default function HistorialTab() {
  const { session } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  // useDashboardAhorro ya refetchea solo al volver a esta tab (useFocusEffect),
  // pero escanear un ticket pasa por un modal sin salir de la ruta — no hay
  // refoco que dispare eso. Se fuerza el remount acá específicamente para ese caso.
  const [refrescarKey, setRefrescarKey] = useState(0);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const cerrarSesion = async () => {
    setCerrandoSesion(true);
    const { error } = await supabase.auth.signOut();
    // Si falla (ej. sin red), volver a habilitar el botón — si sale bien,
    // el gate de sesión en _layout.tsx desmonta esta pantalla solo.
    if (error) setCerrandoSesion(false);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <DashboardAhorroScreen key={refrescarKey} />

        <PressableFeedback
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Escanear ticket"
        >
          <Text style={styles.fabTexto}>📷</Text>
        </PressableFeedback>

        <EscanearTicketModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onGuardado={() => setRefrescarKey((k) => k + 1)}
        />
      </View>

      {session && (
        <View style={styles.cuenta}>
          <Text style={styles.email}>{session.user.email}</Text>
          <PressableFeedback
            style={[styles.boton, cerrandoSesion && styles.botonDisabled]}
            onPress={cerrarSesion}
            disabled={cerrandoSesion}
          >
            {cerrandoSesion ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <Text style={styles.botonTexto}>Cerrar sesión</Text>
            )}
          </PressableFeedback>
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
  botonDisabled: { opacity: 0.5 },
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
