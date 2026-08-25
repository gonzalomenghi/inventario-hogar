import { Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import CategoriaPicker from './CategoriaPicker';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useAuth } from '../hooks/useAuth';
import { useBuscarProductoSimilar } from '../hooks/useBuscarProductoSimilar';
import type { ResultadoBusquedaProducto } from '../hooks/useBuscarProductoSimilar';
import { supabase } from '../lib/supabase';
import type { TablesInsert } from '../types/database.types';

// Producto ya existente en productos_base, elegido de la búsqueda: se
// agrega directo a inventario_hogar, sin crear nada nuevo.
interface ProductoExistente {
  id: string;
  nombre: string;
  unidad_medida: string;
}

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
  const { resultados, buscando } = useBuscarProductoSimilar(
    // No busques si ya se eligió algo: evita relanzar la búsqueda al
    // prellenar nombreProducto con una sugerencia SEPA.
    query
  );

  const [productoExistente, setProductoExistente] = useState<ProductoExistente | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nombreProducto, setNombreProducto] = useState('');

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
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
      setProductoExistente(null);
      setCreandoNuevo(false);
      setNombreProducto('');
      setCategoriaId(null);
      setUnidadMedida('unidad');
      setCodigoBarras('');
      setMarca('');
      setCantidadActual('1');
      setStockMinimo('1');
      setFechaVencimiento('');
      setError(null);
    }
  }, [visible]);

  const elegirResultado = (r: ResultadoBusquedaProducto) => {
    if (r.origen === 'propio' && r.id) {
      setProductoExistente({ id: r.id, nombre: r.nombre, unidad_medida: r.unidad_medida ?? 'unidad' });
      return;
    }

    // 'sepa': sugerencia del catálogo de referencia, todavía no existe en
    // productos_base — prellena el formulario de creación con lo que sabemos.
    setNombreProducto(r.nombre);
    setCategoriaId(r.categoria_id ?? null);
    setUnidadMedida(r.unidad_medida ?? 'unidad');
    setCodigoBarras(r.codigo_barras ?? '');
    setMarca(r.marca ?? '');
    setCreandoNuevo(true);
  };

  const crearProductoYAgregar = async () => {
    if (!session) return;
    setError(null);
    setGuardando(true);

    let producto = productoExistente;

    if (!producto) {
      if (!categoriaId) {
        setError('Elegí una categoría.');
        setGuardando(false);
        return;
      }

      const nuevoProducto: TablesInsert<'productos_base'> = {
        nombre: nombreProducto.trim(),
        categoria_id: categoriaId,
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
      producto = { id: data.id, nombre: data.nombre, unidad_medida: data.unidad_medida };
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

  const pasoCantidad = !!productoExistente || creandoNuevo;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.titulo}>Agregar producto</Text>
            <PressableFeedback style={styles.botonCerrar} onPress={onClose} accessibilityLabel="Cerrar">
              <X size={15} color={Colors.textSecondary} strokeWidth={2.75} />
            </PressableFeedback>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {!pasoCantidad && (
              <>
                <View style={styles.buscador}>
                  <Search size={17} color={Colors.textSecondary} strokeWidth={2.75} />
                  <TextInput
                    style={styles.buscadorInput}
                    placeholder="Buscar producto (ej: arroz)"
                    placeholderTextColor={Colors.textSecondary}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                  />
                </View>

                {buscando && <ActivityIndicator style={styles.spinner} />}

                {resultados.map((r, i) => (
                  <PressableFeedback
                    key={`${r.origen}-${r.id ?? r.codigo_barras ?? r.nombre}-${i}`}
                    style={styles.resultado}
                    onPress={() => elegirResultado(r)}
                  >
                    <View style={styles.resultadoInfo}>
                      <Text style={styles.resultadoNombre}>{r.nombre}</Text>
                      <Text style={styles.resultadoCategoria}>
                        {r.categoria_icono ? `${r.categoria_icono} ` : ''}
                        {r.categoria_nombre ?? '—'}
                      </Text>
                    </View>
                    {r.origen === 'sepa' && (
                      <View style={styles.badgeSepa}>
                        <Text style={styles.badgeSepaTexto}>catálogo</Text>
                      </View>
                    )}
                    <Text style={styles.resultadoAccion}>Agregar</Text>
                  </PressableFeedback>
                ))}

                {query.trim().length >= 2 && !buscando && (
                  <PressableFeedback
                    style={styles.crearNuevo}
                    onPress={() => {
                      setNombreProducto(query.trim());
                      setCreandoNuevo(true);
                    }}
                  >
                    <Text style={styles.crearNuevoTexto}>
                      + Crear "{query.trim()}" como producto nuevo
                    </Text>
                  </PressableFeedback>
                )}
              </>
            )}

            {creandoNuevo && !productoExistente && (
              <View style={styles.seccion}>
                <Text style={styles.label}>Categoría</Text>
                <CategoriaPicker value={categoriaId} onChange={setCategoriaId} />

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
                  {productoExistente?.nombre ?? nombreProducto}
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
              <PressableFeedback
                style={[styles.boton, guardando && styles.botonDisabled]}
                onPress={crearProductoYAgregar}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.botonTexto}>Agregar al inventario</Text>
                )}
              </PressableFeedback>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(42,30,26,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titulo: { fontSize: 19, fontFamily: Fonts.bold, color: Colors.textPrimary },
  botonCerrar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  buscadorInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 999,
    padding: 12,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  spinner: { marginVertical: 8 },
  resultado: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f6ecdd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  resultadoInfo: { flex: 1 },
  resultadoNombre: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  resultadoCategoria: { fontSize: 12.5, color: Colors.textSecondary, fontFamily: Fonts.medium, marginTop: 1 },
  resultadoAccion: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  badgeSepa: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeSepaTexto: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.bold },
  crearNuevo: { paddingVertical: 14 },
  crearNuevoTexto: { color: Colors.primary, fontFamily: Fonts.bold, fontSize: 14 },
  seccion: { marginTop: 4 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 4, fontFamily: Fonts.semibold },
  productoElegido: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 12 },
  error: { color: Colors.error, textAlign: 'center', marginTop: 8, fontFamily: Fonts.medium },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#c1552c',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 15.5 },
});
