import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import CategoriaPicker from './CategoriaPicker';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import type { InventarioItem } from '../types/database.types';

// Detalle de un producto del inventario: categoría, stock mínimo y
// vencimiento son editables; el resto queda de solo lectura. Categoría
// vive en productos_base (catálogo compartido) y stock/vencimiento en
// inventario_hogar (fila propia del usuario) — dos tablas, dos updates
// separados, con su propio botón cada uno para que quede claro cuál
// mitad se guardó si la otra falla.
export default function DetalleProductoModal({
  visible,
  item,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  item: InventarioItem | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [stockMinimo, setStockMinimo] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState<string | null>(null);
  const [categoriaGuardada, setCategoriaGuardada] = useState(false);

  const [guardandoStock, setGuardandoStock] = useState(false);
  const [errorStock, setErrorStock] = useState<string | null>(null);
  const [stockGuardado, setStockGuardado] = useState(false);

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  useEffect(() => {
    if (visible && item) {
      setCategoriaId(item.producto?.categoria_id ?? null);
      setStockMinimo(String(item.stock_minimo));
      setFechaVencimiento(item.fecha_vencimiento ?? '');
      setErrorCategoria(null);
      setErrorStock(null);
      setCategoriaGuardada(false);
      setStockGuardado(false);
      setConfirmandoEliminar(false);
      setErrorEliminar(null);
    }
  }, [visible, item]);

  if (!item) return null;

  const guardarCategoria = async () => {
    if (!categoriaId || !item.producto) return;
    setGuardandoCategoria(true);
    setErrorCategoria(null);
    setCategoriaGuardada(false);

    const { error } = await supabase
      .from('productos_base')
      .update({ categoria_id: categoriaId })
      .eq('id', item.producto.id);

    setGuardandoCategoria(false);

    if (error) {
      setErrorCategoria(error.message);
      return;
    }
    setCategoriaGuardada(true);
    onGuardado();
  };

  const guardarStock = async () => {
    setGuardandoStock(true);
    setErrorStock(null);
    setStockGuardado(false);

    const { error } = await supabase
      .from('inventario_hogar')
      .update({
        stock_minimo: Number(stockMinimo.replace(',', '.')) || 0,
        fecha_vencimiento: fechaVencimiento.trim() || null,
      })
      .eq('id', item.id);

    setGuardandoStock(false);

    if (error) {
      setErrorStock(error.message);
      return;
    }
    setStockGuardado(true);
    onGuardado();
  };

  // Borra solo la fila de inventario_hogar del usuario — no toca
  // productos_base (catálogo compartido, referenciado por historial de
  // precios y otras listas) ni el historial de precios ya registrado.
  const eliminarDelInventario = async () => {
    setEliminando(true);
    setErrorEliminar(null);

    const { error } = await supabase.from('inventario_hogar').delete().eq('id', item.id);

    setEliminando(false);

    if (error) {
      setErrorEliminar(error.message);
      return;
    }

    onGuardado();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.titulo}>Detalle del producto</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.cerrar}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.nombre}>{item.producto?.nombre}</Text>
            {item.producto?.marca && <Text style={styles.dato}>Marca: {item.producto.marca}</Text>}
            {item.producto?.codigo_barras && (
              <Text style={styles.dato}>Código de barras: {item.producto.codigo_barras}</Text>
            )}
            <Text style={styles.dato}>
              Cantidad actual: {item.cantidad_actual} {item.unidad_medida}
            </Text>

            <View style={styles.seccion}>
              <Text style={styles.label}>Categoría</Text>
              <CategoriaPicker value={categoriaId} onChange={setCategoriaId} />

              {errorCategoria && <Text style={styles.error}>{errorCategoria}</Text>}
              {categoriaGuardada && <Text style={styles.ok}>Categoría guardada.</Text>}

              <Pressable
                style={[styles.boton, guardandoCategoria && styles.botonDisabled]}
                onPress={guardarCategoria}
                disabled={guardandoCategoria || !categoriaId}
              >
                {guardandoCategoria ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.botonTexto}>Guardar categoría</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.seccion}>
              <Text style={styles.label}>Stock mínimo (para el semáforo)</Text>
              <TextInput
                style={styles.input}
                value={stockMinimo}
                onChangeText={setStockMinimo}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Fecha de vencimiento (opcional, AAAA-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={fechaVencimiento}
                onChangeText={setFechaVencimiento}
                placeholder="2026-12-31"
              />

              {errorStock && <Text style={styles.error}>{errorStock}</Text>}
              {stockGuardado && <Text style={styles.ok}>Cambios guardados.</Text>}

              <Pressable
                style={[styles.boton, guardandoStock && styles.botonDisabled]}
                onPress={guardarStock}
                disabled={guardandoStock}
              >
                {guardandoStock ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.botonTexto}>Guardar cambios</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.seccion}>
              {errorEliminar && <Text style={styles.error}>{errorEliminar}</Text>}

              {!confirmandoEliminar ? (
                <Pressable
                  style={styles.botonEliminar}
                  onPress={() => setConfirmandoEliminar(true)}
                >
                  <Text style={styles.botonEliminarTexto}>Eliminar del inventario</Text>
                </Pressable>
              ) : (
                <View style={styles.confirmEliminar}>
                  <Text style={styles.confirmEliminarTexto}>
                    ¿Eliminar "{item.producto?.nombre}" de tu inventario?
                  </Text>
                  <View style={styles.confirmEliminarBotones}>
                    <Pressable
                      style={styles.confirmCancelar}
                      onPress={() => setConfirmandoEliminar(false)}
                      disabled={eliminando}
                    >
                      <Text style={styles.confirmCancelarTexto}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.confirmEliminarBoton, eliminando && styles.botonDisabled]}
                      onPress={eliminarDelInventario}
                      disabled={eliminando}
                    >
                      {eliminando ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <Text style={styles.confirmEliminarBotonTexto}>Sí, eliminar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titulo: { fontSize: 18, fontWeight: '700' },
  cerrar: { color: Colors.primary, fontWeight: '600' },
  nombre: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  dato: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  seccion: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundMuted,
    gap: 4,
  },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  error: { color: Colors.error, fontSize: 13, marginTop: 4 },
  ok: { color: Colors.success, fontSize: 13, marginTop: 4 },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  botonEliminar: { alignItems: 'center', padding: 8 },
  botonEliminarTexto: { color: Colors.error, fontWeight: '600', fontSize: 14 },
  confirmEliminar: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  confirmEliminarTexto: { fontSize: 14, color: Colors.textPrimary, textAlign: 'center' },
  confirmEliminarBotones: { flexDirection: 'row', gap: 8 },
  confirmCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  confirmCancelarTexto: { color: Colors.textSecondary, fontWeight: '600' },
  confirmEliminarBoton: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  confirmEliminarBotonTexto: { color: Colors.white, fontWeight: '700' },
});
