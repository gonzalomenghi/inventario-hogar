import React, { useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AgregarProductoModal from './AgregarProductoModal';
import DetalleProductoModal from './DetalleProductoModal';
import EscanearTicketModal from './EscanearTicketModal';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { useCategorias } from '../hooks/useCategorias';
import { useInventario } from '../hooks/useInventario';
import type { EstadoStock, InventarioItem } from '../types/database.types';

const COLOR_SEMAFORO: Record<EstadoStock, string> = {
  rojo: Colors.error,
  amarillo: Colors.warning,
  verde: Colors.success,
};

export default function InventarioScreen() {
  const { items, loading, error, ajustarCantidad, refetch } = useInventario();
  const { categorias } = useCategorias();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTicketVisible, setModalTicketVisible] = useState(false);
  const [detalleItem, setDetalleItem] = useState<InventarioItem | null>(null);
  // Efímero, sin persistir: son 3 categorías hoy, re-expandir cuesta un
  // tap y persistir agregaría un read async al montar para poco beneficio.
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const secciones = useMemo(() => {
    return categorias
      .map((cat) => {
        const itemsCategoria = items.filter((it) => it.producto?.categoria_id === cat.id);
        return {
          id: cat.id,
          title: `${cat.icono} ${cat.nombre}`,
          count: itemsCategoria.length,
          // SectionList no tiene collapse nativo: se mantiene la sección
          // (con su header) en el array y se le pasa data: [] cuando está
          // colapsada, así el header sigue visible pero sin ítems debajo.
          data: colapsadas.has(cat.id) ? [] : itemsCategoria,
        };
      })
      .filter((sec) => sec.count > 0);
  }, [items, categorias, colapsadas]);

  const toggleColapsada = (categoriaId: string) => {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(categoriaId)) next.delete(categoriaId);
      else next.add(categoriaId);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>No se pudo cargar el inventario: {error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text>Todavía no cargaste productos. Usá el botón + para empezar.</Text>
        </View>
      ) : (
        <SectionList
          sections={secciones}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <SeccionHeader
              titulo={section.title}
              cantidad={section.count}
              colapsada={colapsadas.has(section.id)}
              onToggle={() => toggleColapsada(section.id)}
            />
          )}
          renderItem={({ item }) => (
            <ItemInventario item={item} onAjustar={ajustarCantidad} onDetalle={setDetalleItem} />
          )}
        />
      )}

      <PressableFeedback
        style={styles.fabTicket}
        onPress={() => setModalTicketVisible(true)}
        accessibilityLabel="Escanear ticket"
      >
        <Text style={styles.fabTicketTexto}>📷</Text>
      </PressableFeedback>

      <PressableFeedback
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Agregar producto"
      >
        <Text style={styles.fabTexto}>+</Text>
      </PressableFeedback>

      <AgregarProductoModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAgregado={refetch}
      />

      <EscanearTicketModal
        visible={modalTicketVisible}
        onClose={() => setModalTicketVisible(false)}
        onGuardado={refetch}
      />

      <DetalleProductoModal
        visible={!!detalleItem}
        item={detalleItem}
        onClose={() => setDetalleItem(null)}
        onGuardado={refetch}
      />
    </View>
  );
}

// Componente propio (no una función inline en renderSectionHeader) porque
// necesita su propio useSharedValue por sección — un render-prop plano no
// puede usar hooks de forma consistente entre renders.
function SeccionHeader({
  titulo,
  cantidad,
  colapsada,
  onToggle,
}: {
  titulo: string;
  cantidad: number;
  colapsada: boolean;
  onToggle: () => void;
}) {
  const rotacion = useSharedValue(colapsada ? -90 : 0);

  useEffect(() => {
    rotacion.value = withTiming(colapsada ? -90 : 0, { duration: 200 });
  }, [colapsada, rotacion]);

  const estiloChevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotacion.value}deg` }],
  }));

  return (
    <PressableFeedback style={styles.sectionHeader} onPress={onToggle}>
      <Text style={styles.sectionHeaderTexto}>
        {titulo} ({cantidad})
      </Text>
      <Animated.Text style={[styles.sectionHeaderChevron, estiloChevron]}>▾</Animated.Text>
    </PressableFeedback>
  );
}

function ItemInventario({
  item,
  onAjustar,
  onDetalle,
}: {
  item: InventarioItem;
  onAjustar: (id: string, delta: number) => void;
  onDetalle: (item: InventarioItem) => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.duration(200)}
    >
      <PressableFeedback style={styles.card} onPress={() => onDetalle(item)}>
        <View style={[styles.semaforoDot, { backgroundColor: COLOR_SEMAFORO[item.estado_stock] }]} />

        <View style={styles.info}>
          <Text style={styles.nombre}>{item.producto?.nombre}</Text>
          <Text style={styles.cantidad}>
            {item.cantidad_actual} {item.unidad_medida}
            {item.fecha_vencimiento ? ` · vence ${item.fecha_vencimiento}` : ''}
          </Text>
        </View>

        <View style={styles.controles}>
          <PressableFeedback
            style={styles.botonControl}
            onPress={() => onAjustar(item.id, -1)}
            accessibilityLabel={`Restar unidad a ${item.producto?.nombre}`}
          >
            <Text style={styles.botonTexto}>−</Text>
          </PressableFeedback>
          <PressableFeedback
            style={styles.botonControl}
            onPress={() => onAjustar(item.id, 1)}
            accessibilityLabel={`Sumar unidad a ${item.producto?.nombre}`}
          >
            <Text style={styles.botonTexto}>+</Text>
          </PressableFeedback>
        </View>
      </PressableFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: Colors.error, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderTexto: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: Colors.textSecondary,
  },
  sectionHeaderChevron: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  semaforoDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  info: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '600' },
  cantidad: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  controles: { flexDirection: 'row', gap: 8 },
  botonControl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
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
  fabTexto: { color: Colors.white, fontSize: 28, fontWeight: '600', lineHeight: 30 },
  fabTicket: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabTicketTexto: { fontSize: 20 },
});
