import { SafeAreaView } from 'react-native-safe-area-context';

import InventarioScreen from '../../screens/InventarioScreen';

export default function InventarioTab() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <InventarioScreen />
    </SafeAreaView>
  );
}
