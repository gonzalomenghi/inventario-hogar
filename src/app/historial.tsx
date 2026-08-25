import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <DashboardAhorroScreen key={refrescarKey} />

        <PressableFeedback
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Escanear ticket"
        >
          <Camera size={20} color={Colors.primary} strokeWidth={2.75} />
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
          <PressableFeedback onPress={cerrarSesion} disabled={cerrandoSesion}>
            {cerrandoSesion ? (
              <ActivityIndicator color={Colors.primary} size="small" />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  email: { color: Colors.textSecondary, fontSize: 12.5, fontFamily: Fonts.medium },
  botonTexto: { color: Colors.primary, fontFamily: Fonts.bold, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
