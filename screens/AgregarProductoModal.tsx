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
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { CategoriaProducto, ProductoBase, TablesInsert } from '../types/database.types';

const LABEL_CATEGORIA: Record<CategoriaProducto, string> = {
  alimentos: 'Alimentos',
  higiene: 'Higiene',
  limpieza: 'Limpieza',
};

const CATEGORIAS: CategoriaProducto[] = ['alimentos', 'higiene', 'limpieza'];

export default function AgregarProductoModal({
  visible,
  onClose,
  onAgregado,
}: {
  visible: boolean;
  onClose: () => void;
  onAgregado: () => void;
}) {
  const { session } = useAuth();

  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ProductoBase[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoBase | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);

  const [categoria, setCategoria] = useState<CategoriaProducto>('alimentos');
  const [unidadMedida, setUnidadMedida] = useState('unidad');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [marca, setMarca] = useState('');

  const [cantidadActual, setCantidadActual] = useState('1');
  const [stockMinimo, setStockMinimo] = useState('1');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      // reset al cerrar
      setQuery('');
      setResultados([]);
      setProductoSeleccionado(null);
      setCreandoNuevo(false);
      setCategoria('alimentos');
      setUnidadMedida('unidad');
      setCodigoBarras('');
      setMarca('');
      setCantidadActual('1');
      setStockMinimo('1');
      setFechaVencimiento('');
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || productoSeleccionado || creandoNuevo) return;
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }

    let cancelado = false;
    setBuscando(true);
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('productos_base')
        .select('*')
        .ilike('nombre', `%${query.trim()}%`)
        .limit(10);

      if (!cancelado) {
        setResultados(data ?? []);
        setBuscando(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [query, visible, productoSeleccionado, creandoNuevo]);

  const crearProductoYAgregar = async () => {
    if (!session) return;
    setError(null);
    setGuardando(true);

    let producto = productoSeleccionado;

    if (!producto) {
      const nuevoProducto: TablesInsert<'productos_base'> = {
        nombre: query.trim(),
        categoria,
        unidad_medida: unidadMedida.trim() || 'unidad',
        codigo_barras: codigoBarras.trim() || null,
        marca: marca.trim() || null,
      };

      const { data, error: errorProducto } = await supabase
        .from('productos_base')
        .insert(nuevoProducto)
        .select()
        .single();

      if (errorProducto || !data) {
        setError(errorProducto?.message ?? 'No se pudo crear el producto.');
        setGuardando(false);
        return;
      }
      producto = data;
    }

    const nuevoItem: TablesInsert<'inventario_hogar'> = {
      user_id: session.user.id,
      producto_id: producto.id,
      cantidad_actual: Number(cantidadActual.replace(',', '.')) || 0,
      stock_minimo: Number(stockMinimo.replace(',', '.')) || 1,
      unidad_medida: producto.unidad_medida,
      fecha_vencimiento: fechaVencimiento.trim() || null,
    };

    const { error: errorInventario } = await supabase.from('inventario_hogar').insert(nuevoItem);

    setGuardando(false);

    if (errorInventario) {
      setError(
        errorInventario.code === '23505'
          ? 'Ese producto ya está en tu inventario. Ajustalo desde la lista.'
          : errorInventario.message
      );
      return;
    }

    onAgregado();
    onClose();
  };

  const pasoCantidad = productoSeleccionado || creandoNuevo;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.titulo}>Agregar producto</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.cerrar}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {!pasoCantidad && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Buscar producto (ej: arroz)"
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    setProductoSeleccionado(null);
                  }}
                  autoFocus
                />

                {buscando && <ActivityIndicator style={styles.spinner} />}

                {resultados.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.resultado}
                    onPress={() => setProductoSeleccionado(p)}
                  >
                    <Text style={styles.resultadoNombre}>{p.nombre}</Text>
                    <Text style={styles.resultadoCategoria}>{LABEL_CATEGORIA[p.categoria]}</Text>
                  </Pressable>
                ))}

                {query.trim().length >= 2 && !buscando && (
                  <Pressable style={styles.crearNuevo} onPress={() => setCreandoNuevo(true)}>
                    <Text style={styles.crearNuevoTexto}>
                      + Crear "{query.trim()}" como producto nuevo
                    </Text>
                  </Pressable>
                )}
              </>
            )}

            {creandoNuevo && !productoSeleccionado && (
              <View style={styles.seccion}>
                <Text style={styles.label}>Categoría</Text>
                <View style={styles.chips}>
                  {CATEGORIAS.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.chip, categoria === cat && styles.chipActivo]}
                      onPress={() => setCategoria(cat)}
                    >
                      <Text
                        style={[
                          styles.chipTexto,
                          categoria === cat && styles.chipTextoActivo,
                        ]}
                      >
                        {LABEL_CATEGORIA[cat]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Unidad de medida</Text>
                <TextInput
                  style={styles.input}
                  value={unidadMedida}
                  onChangeText={setUnidadMedida}
                  placeholder="unidad, kg, litro..."
                />

                <Text style={styles.label}>Marca (opcional)</Text>
                <TextInput style={styles.input} value={marca} onChangeText={setMarca} />

                <Text style={styles.label}>Código de barras (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={codigoBarras}
                  onChangeText={setCodigoBarras}
                  keyboardType="numeric"
                />
              </View>
            )}

            {pasoCantidad && (
              <View style={styles.seccion}>
                <Text style={styles.productoElegido}>
                  {productoSeleccionado?.nombre ?? query.trim()}
                </Text>

                <Text style={styles.label}>Cantidad actual</Text>
                <TextInput
                  style={styles.input}
                  value={cantidadActual}
                  onChangeText={setCantidadActual}
                  keyboardType="decimal-pad"
                />

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
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            {pasoCantidad && (
              <Pressable
                style={[styles.boton, guardando && styles.botonDisabled]}
                onPress={crearProductoYAgregar}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botonTexto}>Agregar al inventario</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
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
  cerrar: { color: '#208AEF', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  spinner: { marginVertical: 8 },
  resultado: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultadoNombre: { fontSize: 15, fontWeight: '600' },
  resultadoCategoria: { fontSize: 13, color: '#6B7280' },
  crearNuevo: { paddingVertical: 14 },
  crearNuevoTexto: { color: '#208AEF', fontWeight: '600' },
  seccion: { marginTop: 4 },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 6, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActivo: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chipTexto: { color: '#111827', fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  productoElegido: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  error: { color: '#E5484D', textAlign: 'center', marginTop: 8 },
  boton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
