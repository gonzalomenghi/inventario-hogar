import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistorialTab() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.centered}>
        <Text style={styles.mensaje}>
          El historial de precios y gasto llega en una fase más adelante.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensaje: { textAlign: 'center', color: '#6B7280', fontSize: 15 },
});
