import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput, Modal } from 'react-native';
import AgregarItemListaModal from './AgregarItemListaModal';
import DescuentoPicker from './DescuentoPicker';
import SupermercadoPicker from './SupermercadoPicker';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import type { DetalleListaItem, TipoDescuento } from '../types/database.types';

interface DescuentoEdicion {
  tipo: TipoDescuento;
  valor: string;
}

export default function ModoSupermercadoScreen({
  listaId,
  onSalir,
}: {
  listaId: string;
  onSalir: () => void;
}) {
  const [detalle, setDetalle] = useState<DetalleListaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [precioEnEdicion, setPrecioEnEdicion] = useState<Record<string, string>>({});
  const [descuentoEnEdicion, setDescuentoEnEdicion] = useState<Record<string, DescuentoEdicion>>({});
  const [supermercadoEnEdicion, setSupermercadoEnEdicion] = useState<Record<string, string | null>>({});
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  const [supermercadoListaId, setSupermercadoListaId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmSalirVisible, setConfirmSalirVisible] = useState(false);
  const [procesandoSalida, setProcesandoSalida] = useState(false);

  const fetchDetalle = useCallback(async () => {
    const { data, error } = await supabase
      .from('detalle_lista')
      .select('*, producto:productos_base(*)')
      .eq('lista_id', listaId)
      .order('comprado', { ascending: true });

    if (!error) setDetalle((data ?? []) as DetalleListaItem[]);
    setLoading(false);
  }, [listaId]);

  const fetchSupermercadoLista = useCallback(async () => {
    const { data } = await supabase
      .from('listas_compra')
      .select('supermercado_id')
      .eq('id', listaId)
      .single();

    setSupermercadoListaId((data as { supermercado_id: string | null } | null)?.supermercado_id ?? null);
  }, [listaId]);

  useEffect(() => {
    fetchDetalle();
    fetchSupermercadoLista();
  }, [fetchDetalle, fetchSupermercadoLista]);

  const toggleExpandido = (itemId: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // "Cancelar": no borra nada, solo saca la lista de estado 'activa' (queda
  // como registro en el historial). "Eliminar": borra la lista de verdad —
  // detalle_lista se va con ella por el ON DELETE CASCADE de su FK a
  // listas_compra. Ninguna de las dos toca inventario_hogar/precios_historico
  // de los ítems ya comprados: esos son compras reales, ya sucedieron.
  const cancelarLista = async () => {
    setProcesandoSalida(true);
    const { error } = await supabase
      .from('listas_compra')
      .update({ estado: 'cancelada' })
      .eq('id', listaId);
    setProcesandoSalida(false);

    if (!error) {
      setConfirmSalirVisible(false);
      onSalir();
    }
  };

  const eliminarLista = async () => {
    setProcesandoSalida(true);
    const { error } = await supabase.from('listas_compra').delete().eq('id', listaId);
    setProcesandoSalida(false);

    if (!error) {
      setConfirmSalirVisible(false);
      onSalir();
    }
  };

  // Al tildar el check: si cargó precio/descuento (acá o al agregar el
  // ítem a la lista), el trigger fn_comprar_item_lista se encarga de
  // sumar el stock y guardar el histórico de precio automáticamente.
  // Importante: si el usuario no tocó nada acá, hay que mandar lo que YA
  // tenía el ítem (no null) — si no, se pisa el precio/descuento que se
  // haya cargado al agregarlo manualmente a la lista.
  const marcarComprado = async (item: DetalleListaItem) => {
    const precioTexto = precioEnEdicion[item.id];
    const precio = precioTexto?.trim() ? parseFloat(precioTexto.replace(',', '.')) : item.precio_unitario;

    const descuento = descuentoEnEdicion[item.id];
    const tipoDescuento = descuento?.tipo ?? item.tipo_descuento;
    const valorDescuento = descuento
      ? descuento.valor.trim()
        ? parseFloat(descuento.valor.replace(',', '.'))
        : null
      : item.valor_descuento;

    const supermercadoId =
      item.id in supermercadoEnEdicion ? supermercadoEnEdicion[item.id] : item.supermercado_id;

    setDetalle((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, comprado: true } : it))
    );

    const { error } = await supabase
      .from('detalle_lista')
      .update({
        comprado: true,
        cantidad_comprada: item.cantidad_solicitada,
        precio_unitario: precio,
        tipo_descuento: tipoDescuento,
        valor_descuento: valorDescuento,
        supermercado_id: supermercadoId,
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.botonSalir}
          onPress={() => setConfirmSalirVisible(true)}
          accessibilityLabel="Salir de la lista"
        >
          <Text style={styles.botonSalirTexto}>‹ Salir</Text>
        </Pressable>
      </View>

      <FlatList
        data={[...pendientes, ...comprados]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.progreso}>
            {comprados.length} / {detalle.length} comprados
          </Text>
        }
        renderItem={({ item }) => {
          const abierto = expandido.has(item.id);
          const descuento = descuentoEnEdicion[item.id] ?? {
            tipo: item.tipo_descuento,
            valor: item.valor_descuento != null ? String(item.valor_descuento) : '',
          };
          const supermercadoActual =
            item.id in supermercadoEnEdicion ? supermercadoEnEdicion[item.id] : item.supermercado_id;

          return (
            <View style={[styles.row, item.comprado && styles.rowComprado]}>
              <View style={styles.filaPrincipal}>
                <Pressable
                  style={[styles.checkbox, item.comprado && styles.checkboxActivo]}
                  onPress={() => !item.comprado && marcarComprado(item)}
                  accessibilityLabel={`Marcar comprado: ${item.producto?.nombre}`}
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
                  <>
                    <TextInput
                      style={styles.inputPrecio}
                      placeholder="$"
                      keyboardType="decimal-pad"
                      value={precioEnEdicion[item.id] ?? (item.precio_unitario != null ? String(item.precio_unitario) : '')}
                      onChangeText={(t) =>
                        setPrecioEnEdicion((prev) => ({ ...prev, [item.id]: t }))
                      }
                    />
                    <Pressable
                      style={styles.botonExpandir}
                      onPress={() => toggleExpandido(item.id)}
                      accessibilityLabel={`Más opciones para ${item.producto?.nombre}`}
                    >
                      <Text style={styles.botonExpandirTexto}>{abierto ? '︿' : '⋯'}</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {!item.comprado && abierto && (
                <View style={styles.expansion}>
                  <Text style={styles.label}>Descuento</Text>
                  <DescuentoPicker
                    tipo={descuento.tipo}
                    valor={descuento.valor}
                    onChangeTipo={(tipo) =>
                      setDescuentoEnEdicion((prev) => ({ ...prev, [item.id]: { ...descuento, tipo } }))
                    }
                    onChangeValor={(valor) =>
                      setDescuentoEnEdicion((prev) => ({ ...prev, [item.id]: { ...descuento, valor } }))
                    }
                  />

                  <Text style={styles.label}>Supermercado</Text>
                  <SupermercadoPicker
                    value={supermercadoActual}
                    onChange={(id) =>
                      setSupermercadoEnEdicion((prev) => ({ ...prev, [item.id]: id }))
                    }
                  />
                </View>
              )}
            </View>
          );
        }}
      />

      <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Agregar producto a la lista"
      >
        <Text style={styles.fabTexto}>+</Text>
      </Pressable>

      <AgregarItemListaModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAgregado={fetchDetalle}
        listaId={listaId}
        supermercadoIdDefault={supermercadoListaId}
      />

      <Modal
        visible={confirmSalirVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmSalirVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitulo}>¿Qué querés hacer con esta lista?</Text>

            <Pressable
              style={[styles.confirmBoton, procesandoSalida && styles.botonDisabled]}
              onPress={cancelarLista}
              disabled={procesandoSalida}
            >
              <Text style={styles.confirmBotonTexto}>Cancelar lista y salir</Text>
            </Pressable>

            <Pressable
              style={[styles.confirmBotonDestructivo, procesandoSalida && styles.botonDisabled]}
              onPress={eliminarLista}
              disabled={procesandoSalida}
            >
              <Text style={styles.confirmBotonDestructivoTexto}>Eliminar lista y sus ítems</Text>
            </Pressable>

            <Pressable
              style={styles.confirmVolver}
              onPress={() => setConfirmSalirVisible(false)}
              disabled={procesandoSalida}
            >
              <Text style={styles.confirmVolverTexto}>Volver</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  botonSalir: { paddingVertical: 8, paddingHorizontal: 4 },
  botonSalirTexto: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  listContent: { padding: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progreso: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12, fontWeight: '600' },
  row: {
    backgroundColor: Colors.white,
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  rowComprado: { opacity: 0.5 },
  filaPrincipal: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActivo: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkmark: { color: Colors.white, fontWeight: '700' },
  info: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '600' },
  nombreComprado: { textDecorationLine: 'line-through' },
  cantidad: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  inputPrecio: {
    width: 64,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 6,
    textAlign: 'right',
  },
  botonExpandir: { paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4 },
  botonExpandirTexto: { fontSize: 16, color: Colors.textSecondary, fontWeight: '700' },
  expansion: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundMuted,
    gap: 4,
  },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
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
  botonDisabled: { opacity: 0.5 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  confirmSheet: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  confirmTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  confirmBoton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  confirmBotonTexto: { color: Colors.textPrimary, fontWeight: '600' },
  confirmBotonDestructivo: {
    backgroundColor: Colors.error,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  confirmBotonDestructivoTexto: { color: Colors.white, fontWeight: '700' },
  confirmVolver: { alignItems: 'center', paddingTop: 4 },
  confirmVolverTexto: { color: Colors.textSecondary, fontWeight: '600' },
});
