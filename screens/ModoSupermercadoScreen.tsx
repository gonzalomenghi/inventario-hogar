import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import type { DetalleListaItem } from '../types/database.types';

// Asume que ya existe una lista en estado 'activa' para el usuario
// (la creación/auto-generación de la lista se resuelve en la Fase 3).
export default function ModoSupermercadoScreen({ listaId }: { listaId: string }) {
  const [detalle, setDetalle] = useState<DetalleListaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [precioEnEdicion, setPrecioEnEdicion] = useState<Record<string, string>>({});

  const fetchDetalle = useCallback(async () => {
    const { data, error } = await supabase
      .from('detalle_lista')
      .select('*, producto:productos_base(*)')
      .eq('lista_id', listaId)
      .order('comprado', { ascending: true });

    if (!error) setDetalle((data ?? []) as DetalleListaItem[]);
    setLoading(false);
  }, [listaId]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  // Al tildar el check: si cargó precio, lo manda; el trigger fn_comprar_item_lista
  // se encarga de sumar el stock y guardar el histórico de precio automáticamente.
  const marcarComprado = async (item: DetalleListaItem) => {
    const precioTexto = precioEnEdicion[item.id];
    const precio = precioTexto ? parseFloat(precioTexto.replace(',', '.')) : null;

    setDetalle((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, comprado: true } : it))
    );

    const { error } = await supabase
      .from('detalle_lista')
      .update({
        comprado: true,
        cantidad_comprada: item.cantidad_solicitada,
        precio_unitario: precio,
      })
      .eq('id', item.id);

    if (error) fetchDetalle(); // revertir UI optimista si falla
  };

  const pendientes = detalle.filter((d) => !d.comprado);
  const comprados = detalle.filter((d) => d.comprado);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={[...pendientes, ...comprados]}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <Text style={styles.progreso}>
          {comprados.length} / {detalle.length} comprados
        </Text>
      }
      renderItem={({ item }) => (
        <View style={[styles.row, item.comprado && styles.rowComprado]}>
          <Pressable
            style={[styles.checkbox, item.comprado && styles.checkboxActivo]}
            onPress={() => !item.comprado && marcarComprado(item)}
          >
            {item.comprado && <Text style={styles.checkmark}>✓</Text>}
          </Pressable>

          <View style={styles.info}>
            <Text style={[styles.nombre, item.comprado && styles.nombreComprado]}>
              {item.producto?.nombre}
            </Text>
            <Text style={styles.cantidad}>
              {item.cantidad_solicitada} {item.producto?.unidad_medida}
            </Text>
          </View>

          {!item.comprado && (
            <TextInput
              style={styles.inputPrecio}
              placeholder="$"
              keyboardType="decimal-pad"
              value={precioEnEdicion[item.id] ?? ''}
              onChangeText={(t) =>
                setPrecioEnEdicion((prev) => ({ ...prev, [item.id]: t }))
              }
            />
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progreso: { fontSize: 14, color: '#6B7280', marginBottom: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowComprado: { opacity: 0.5 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActivo: { backgroundColor: '#30A46C', borderColor: '#30A46C' },
  checkmark: { color: '#fff', fontWeight: '700' },
  info: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '600' },
  nombreComprado: { textDecorationLine: 'line-through' },
  cantidad: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  inputPrecio: {
    width: 64,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 6,
    textAlign: 'right',
  },
});
