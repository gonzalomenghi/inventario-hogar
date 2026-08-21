import React, { useMemo } from 'react';
import {
  SectionList,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useInventario } from '../hooks/useInventario';
import type { CategoriaProducto, EstadoStock, InventarioItem } from '../types/database.types';

const COLOR_SEMAFORO: Record<EstadoStock, string> = {
  rojo: '#E5484D',
  amarillo: '#F5A623',
  verde: '#30A46C',
};

const LABEL_CATEGORIA: Record<CategoriaProducto, string> = {
  alimentos: 'Alimentos',
  higiene: 'Higiene',
  limpieza: 'Limpieza',
};

export default function InventarioScreen() {
  const { items, loading, error, ajustarCantidad } = useInventario();

  const secciones = useMemo(() => {
    const categorias: CategoriaProducto[] = ['alimentos', 'higiene', 'limpieza'];
    return categorias
      .map((cat) => ({
        title: LABEL_CATEGORIA[cat],
        data: items.filter((it) => it.producto?.categoria === cat),
      }))
      .filter((sec) => sec.data.length > 0);
  }, [items]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se pudo cargar el inventario: {error}</Text>
      </View>
    );
  }

  return (
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
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text>Todavía no cargaste productos. Usá el botón + para empezar.</Text>
        </View>
      }
    />
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
  listContent: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#E5484D', textAlign: 'center' },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  cantidad: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  controles: { flexDirection: 'row', gap: 8 },
  botonControl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { fontSize: 18, fontWeight: '700', color: '#111827' },
});
