import React, { useMemo, useState } from 'react';
import {
  SectionList,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AgregarProductoModal from './AgregarProductoModal';
import EscanearTicketModal from './EscanearTicketModal';
import { Colors } from '../constants/colors';
import { useInventario } from '../hooks/useInventario';
import type { CategoriaProducto, EstadoStock, InventarioItem } from '../types/database.types';

const COLOR_SEMAFORO: Record<EstadoStock, string> = {
  rojo: Colors.error,
  amarillo: Colors.warning,
  verde: Colors.success,
};

const LABEL_CATEGORIA: Record<CategoriaProducto, string> = {
  alimentos: 'Alimentos',
  higiene: 'Higiene',
  limpieza: 'Limpieza',
};

export default function InventarioScreen() {
  const { items, loading, error, ajustarCantidad, refetch } = useInventario();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTicketVisible, setModalTicketVisible] = useState(false);

  const secciones = useMemo(() => {
    const categorias: CategoriaProducto[] = ['alimentos', 'higiene', 'limpieza'];
    return categorias
      .map((cat) => ({
        title: LABEL_CATEGORIA[cat],
        data: items.filter((it) => it.producto?.categoria === cat),
      }))
      .filter((sec) => sec.data.length > 0);
  }, [items]);

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
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <ItemInventario item={item} onAjustar={ajustarCantidad} />
          )}
        />
      )}

      <Pressable
        style={styles.fabTicket}
        onPress={() => setModalTicketVisible(true)}
        accessibilityLabel="Escanear ticket"
      >
        <Text style={styles.fabTicketTexto}>📷</Text>
      </Pressable>

      <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Agregar producto"
      >
        <Text style={styles.fabTexto}>+</Text>
      </Pressable>

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
    </View>
  );
}

function ItemInventario({
  item,
  onAjustar,
}: {
  item: InventarioItem;
  onAjustar: (id: string, delta: number) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.semaforoDot, { backgroundColor: COLOR_SEMAFORO[item.estado_stock] }]} />

      <View style={styles.info}>
        <Text style={styles.nombre}>{item.producto?.nombre}</Text>
        <Text style={styles.cantidad}>
          {item.cantidad_actual} {item.unidad_medida}
          {item.fecha_vencimiento ? ` · vence ${item.fecha_vencimiento}` : ''}
        </Text>
      </View>

      <View style={styles.controles}>
        <Pressable
          style={styles.botonControl}
          onPress={() => onAjustar(item.id, -1)}
          accessibilityLabel={`Restar unidad a ${item.producto?.nombre}`}
        >
          <Text style={styles.botonTexto}>−</Text>
        </Pressable>
        <Pressable
          style={styles.botonControl}
          onPress={() => onAjustar(item.id, 1)}
          accessibilityLabel={`Sumar unidad a ${item.producto?.nombre}`}
        >
          <Text style={styles.botonTexto}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: Colors.error, textAlign: 'center' },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
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
