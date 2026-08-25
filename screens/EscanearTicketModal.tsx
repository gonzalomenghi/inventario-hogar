import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, FileText, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useAuth } from '../hooks/useAuth';
import { useEscanearTicket } from '../hooks/useEscanearTicket';
import { useSupermercados } from '../hooks/useSupermercados';
import { supabase } from '../lib/supabase';
import type { TablesInsert } from '../types/database.types';

// El match contra el catálogo (buscar_producto_similar) se resuelve acá,
// apenas se procesa el ticket — no recién al guardar — para poder mostrar
// "coincide con X" o el badge de producto nuevo en la lista de
// confirmación. confirmarYGuardar reutiliza este resultado en vez de
// volver a pedirlo por ítem.
type MatchItem =
  | { tipo: 'propio'; productoId: string; unidadMedida: string; nombreMatch: string }
  | { tipo: 'nuevo' };

interface ItemEditable {
  nombre: string;
  cantidad: string;
  precioFinal: string;
  incluido: boolean;
  match: MatchItem;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// expo-document-picker ya devuelve base64 en web. En nativo (iOS/Android)
// hay que leer el archivo y codificarlo a mano — expo-file-system no
// tiene un helper de base64 en su API nueva basada en File/Directory.
function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  return btoa(binario);
}

export default function EscanearTicketModal({
  visible,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { session } = useAuth();
  const { procesarTicket, procesando, error: errorProcesar } = useEscanearTicket();
  const { crearSupermercado } = useSupermercados();

  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('image/jpeg');
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const [items, setItems] = useState<ItemEditable[] | null>(null);
  const [resolviendoMatches, setResolviendoMatches] = useState(false);
  const [supermercadoNombre, setSupermercadoNombre] = useState('');
  const [fecha, setFecha] = useState(hoyISO());

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setImagenUri(null);
      setImagenBase64(null);
      setNombreArchivo(null);
      setItems(null);
      setSupermercadoNombre('');
      setFecha(hoyISO());
      setError(null);
    }
  }, [visible]);

  const elegirImagen = async (deCamara: boolean) => {
    setError(null);
    const permiso = deCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      setError(
        deCamara
          ? 'Necesitamos permiso para usar la cámara.'
          : 'Necesitamos permiso para acceder a tus fotos.'
      );
      return;
    }

    const opciones: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    };

    const resultado = deCamara
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);

    if (resultado.canceled || !resultado.assets[0]?.base64) return;

    const asset = resultado.assets[0];
    setImagenUri(asset.uri);
    setImagenBase64(asset.base64!);
    setMediaType(asset.mimeType ?? 'image/jpeg');
    setNombreArchivo(null);
  };

  const elegirPDF = async () => {
    setError(null);
    const resultado = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      base64: true,
    });

    if (resultado.canceled || !resultado.assets[0]) return;

    const asset = resultado.assets[0];

    // En web, expo-document-picker devuelve el data URI completo
    // ("data:application/pdf;base64,XXXX"), no el base64 solo — a
    // diferencia de expo-image-picker, que sí lo limpia. Sacarle el
    // prefijo acá; si no tiene prefijo (nativo, o ya viene limpio) esto
    // no cambia nada.
    let base64 = asset.base64 ? asset.base64.split(',').pop()! : null;

    if (!base64) {
      try {
        const archivo = new File(asset.uri);
        const buffer = await archivo.arrayBuffer();
        base64 = arrayBufferABase64(buffer);
      } catch {
        setError('No se pudo leer el PDF elegido.');
        return;
      }
    }

    setImagenUri(null);
    setImagenBase64(base64);
    setMediaType('application/pdf');
    setNombreArchivo(asset.name);
  };

  const procesar = async () => {
    if (!imagenBase64) return;
    const resultado = await procesarTicket(imagenBase64, mediaType);
    if (!resultado) return;

    // Match provisorio (sin resolver todavía) para mostrar la lista al
    // toque; se completa abajo apenas terminan las búsquedas.
    const itemsBase: ItemEditable[] = resultado.items.map((item) => ({
      nombre: item.nombre,
      cantidad: String(item.cantidad),
      precioFinal: String(item.precio_final),
      incluido: true,
      match: { tipo: 'nuevo' },
    }));
    setItems(itemsBase);
    if (resultado.supermercado_sugerido) setSupermercadoNombre(resultado.supermercado_sugerido);
    if (resultado.fecha_sugerida) setFecha(resultado.fecha_sugerida);

    setResolviendoMatches(true);
    const matches = await Promise.all(
      itemsBase.map(async (item): Promise<MatchItem> => {
        const { data } = await supabase.rpc('buscar_producto_similar', {
          texto_busqueda: item.nombre,
          limite: 1,
        });
        const mejor = data?.[0];
        if (mejor && mejor.origen === 'propio' && mejor.id) {
          return {
            tipo: 'propio',
            productoId: mejor.id,
            unidadMedida: mejor.unidad_medida ?? 'unidad',
            nombreMatch: mejor.nombre,
          };
        }
        return { tipo: 'nuevo' };
      })
    );
    setItems((prev) => (prev ? prev.map((it, i) => ({ ...it, match: matches[i] })) : prev));
    setResolviendoMatches(false);
  };

  const actualizarItem = (i: number, cambios: Partial<ItemEditable>) => {
    setItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, ...cambios } : it)) : prev));
  };

  const confirmarYGuardar = async () => {
    if (!session || !items) return;
    setError(null);
    setGuardando(true);

    let supermercadoId: string | null = null;
    const nombreSuper = supermercadoNombre.trim();

    if (nombreSuper) {
      const supermercado = await crearSupermercado(nombreSuper);
      if (!supermercado) {
        setError('No se pudo guardar el supermercado.');
        setGuardando(false);
        return;
      }
      supermercadoId = supermercado.id;
    }

    // Esta pantalla no tiene selector de categoría (el ticket no la trae),
    // así que un producto nuevo (sin match propio) se crea en "Alimentos"
    // por defecto. Se resuelve una sola vez acá, no por cada ítem del ticket.
    let categoriaAlimentosId: string | null = null;
    const itemsAIncluir = items.filter((it) => it.incluido);
    const necesitaCategoriaDefault = itemsAIncluir.some((it) => it.match.tipo === 'nuevo');

    if (necesitaCategoriaDefault) {
      const { data: categoriaDefault } = await supabase
        .from('categorias')
        .select('id')
        .ilike('nombre', 'alimentos')
        .maybeSingle();

      if (!categoriaDefault) {
        setError('No se encontró la categoría "Alimentos" por defecto; no se pudo procesar el ticket.');
        setGuardando(false);
        return;
      }
      categoriaAlimentosId = categoriaDefault.id;
    }

    for (const item of itemsAIncluir) {
      let productoId: string;
      let unidadMedida: string;

      if (item.match.tipo === 'propio') {
        productoId = item.match.productoId;
        unidadMedida = item.match.unidadMedida;
      } else {
        const nuevoProducto: TablesInsert<'productos_base'> = {
          nombre: item.nombre,
          categoria_id: categoriaAlimentosId!,
          unidad_medida: 'unidad',
        };
        const { data: creado, error: errorProducto } = await supabase
          .from('productos_base')
          .insert(nuevoProducto)
          .select('id, unidad_medida')
          .single();

        if (errorProducto || !creado) {
          setError(errorProducto?.message ?? `No se pudo crear "${item.nombre}".`);
          setGuardando(false);
          return;
        }
        productoId = creado.id;
        unidadMedida = creado.unidad_medida;
      }

      // Comprar algo = sube el stock Y queda el precio registrado, las dos
      // cosas a la vez (no tiene sentido separarlas: un ticket siempre
      // representa una compra real).
      const cantidadComprada = Number(item.cantidad.replace(',', '.')) || 0;

      const { data: itemInventario } = await supabase
        .from('inventario_hogar')
        .select('id, cantidad_actual')
        .eq('producto_id', productoId)
        .maybeSingle();

      if (itemInventario) {
        const { error: errorUpdateInv } = await supabase
          .from('inventario_hogar')
          .update({ cantidad_actual: itemInventario.cantidad_actual + cantidadComprada })
          .eq('id', itemInventario.id);

        if (errorUpdateInv) {
          setError(errorUpdateInv.message);
          setGuardando(false);
          return;
        }
      } else {
        const nuevoInventario: TablesInsert<'inventario_hogar'> = {
          user_id: session.user.id,
          producto_id: productoId,
          cantidad_actual: cantidadComprada,
          stock_minimo: 1,
          unidad_medida: unidadMedida,
        };
        const { error: errorInsertInv } = await supabase
          .from('inventario_hogar')
          .insert(nuevoInventario);

        if (errorInsertInv) {
          setError(errorInsertInv.message);
          setGuardando(false);
          return;
        }
      }

      const precioFinal = Number(item.precioFinal.replace(',', '.')) || 0;
      const nuevoPrecio: TablesInsert<'precios_historico'> = {
        user_id: session.user.id,
        producto_id: productoId,
        supermercado_id: supermercadoId,
        precio: precioFinal,
        precio_final: precioFinal,
        fuente: 'ocr_ticket',
        fecha_registro: fecha ? `${fecha}T00:00:00Z` : undefined,
      };

      const { error: errorPrecio } = await supabase.from('precios_historico').insert(nuevoPrecio);

      if (errorPrecio) {
        setError(errorPrecio.message);
        setGuardando(false);
        return;
      }
    }

    setGuardando(false);
    onGuardado();
    onClose();
  };

  const itemsIncluidos = items?.filter((it) => it.incluido).length ?? 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.titulo}>{items ? 'Ticket detectado' : 'Escanear ticket'}</Text>
            <PressableFeedback style={styles.botonCerrar} onPress={onClose} accessibilityLabel="Cerrar">
              <X size={15} color={Colors.textSecondary} strokeWidth={2.75} />
            </PressableFeedback>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {!items && (
              <>
                {imagenUri ? (
                  <Image source={{ uri: imagenUri }} style={styles.preview} resizeMode="contain" />
                ) : nombreArchivo ? (
                  <View style={styles.previewPdf}>
                    <FileText size={20} color={Colors.textPrimary} strokeWidth={2.75} />
                    <Text style={styles.previewPdfTexto}>{nombreArchivo}</Text>
                  </View>
                ) : (
                  <View style={styles.botonesFoto}>
                    <PressableFeedback style={styles.botonSecundario} onPress={() => elegirImagen(true)}>
                      <Camera size={18} color={Colors.textPrimary} strokeWidth={2.75} />
                      <Text style={styles.botonSecundarioTexto}>Sacar foto</Text>
                    </PressableFeedback>
                    <PressableFeedback style={styles.botonSecundario} onPress={() => elegirImagen(false)}>
                      <ImageIcon size={18} color={Colors.textPrimary} strokeWidth={2.75} />
                      <Text style={styles.botonSecundarioTexto}>Elegir de galería</Text>
                    </PressableFeedback>
                    <PressableFeedback style={styles.botonSecundario} onPress={elegirPDF}>
                      <FileText size={18} color={Colors.textPrimary} strokeWidth={2.75} />
                      <Text style={styles.botonSecundarioTexto}>Elegir PDF</Text>
                    </PressableFeedback>
                  </View>
                )}

                {(error || errorProcesar) && (
                  <Text style={styles.error}>{error ?? errorProcesar}</Text>
                )}

                {imagenBase64 && (
                  <>
                    <PressableFeedback
                      style={[styles.boton, procesando && styles.botonDisabled]}
                      onPress={procesar}
                      disabled={procesando}
                    >
                      {procesando ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <Text style={styles.botonTexto}>Procesar ticket</Text>
                      )}
                    </PressableFeedback>
                    <PressableFeedback
                      onPress={() => {
                        setImagenUri(null);
                        setImagenBase64(null);
                        setNombreArchivo(null);
                      }}
                    >
                      <Text style={styles.link}>Elegir otro archivo</Text>
                    </PressableFeedback>
                  </>
                )}
              </>
            )}

            {items && (
              <View style={styles.seccion}>
                <View style={styles.cardsFila}>
                  <View style={styles.cardDato}>
                    <Text style={styles.cardDatoLabel}>Supermercado</Text>
                    <TextInput
                      style={styles.cardDatoInput}
                      value={supermercadoNombre}
                      onChangeText={setSupermercadoNombre}
                      placeholder="Coto, Dia, Carrefour..."
                    />
                  </View>
                  <View style={styles.cardDato}>
                    <Text style={styles.cardDatoLabel}>Fecha</Text>
                    <TextInput
                      style={styles.cardDatoInput}
                      value={fecha}
                      onChangeText={setFecha}
                      placeholder="AAAA-MM-DD"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Ítems detectados ({items.length})</Text>
                {items.map((item, i) => {
                  const esNuevo = item.match.tipo === 'nuevo';
                  return (
                    <View key={i} style={[styles.filaItem, esNuevo && !resolviendoMatches && styles.filaItemNuevo]}>
                      <PressableFeedback
                        style={[
                          styles.checkbox,
                          item.incluido && !esNuevo && styles.checkboxActivo,
                          item.incluido && esNuevo && !resolviendoMatches && styles.checkboxNuevo,
                        ]}
                        onPress={() => actualizarItem(i, { incluido: !item.incluido })}
                      >
                        {item.incluido && <Check size={13} color={Colors.white} strokeWidth={3} />}
                      </PressableFeedback>

                      <View style={styles.itemCampos}>
                        <TextInput
                          style={styles.inputItemNombre}
                          value={item.nombre}
                          onChangeText={(t) => actualizarItem(i, { nombre: t })}
                        />
                        {resolviendoMatches ? (
                          <Text style={styles.itemSub}>Buscando en tu catálogo…</Text>
                        ) : item.match.tipo === 'propio' ? (
                          <Text style={styles.itemSub}>Coincide con «{item.match.nombreMatch}»</Text>
                        ) : (
                          <Text style={styles.itemSubNuevo}>Producto nuevo → 🍎 Alimentos</Text>
                        )}
                        <View style={styles.itemCamposFila}>
                          <TextInput
                            style={styles.inputItemChico}
                            value={item.cantidad}
                            onChangeText={(t) => actualizarItem(i, { cantidad: t })}
                            keyboardType="decimal-pad"
                            placeholder="cant."
                          />
                          <TextInput
                            style={styles.inputItemChico}
                            value={item.precioFinal}
                            onChangeText={(t) => actualizarItem(i, { precioFinal: t })}
                            keyboardType="decimal-pad"
                            placeholder="$"
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}

                {error && <Text style={styles.error}>{error}</Text>}

                <PressableFeedback
                  style={[styles.boton, guardando && styles.botonDisabled]}
                  onPress={confirmarYGuardar}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.botonTexto}>Sumar {itemsIncluidos} ítems al inventario</Text>
                  )}
                </PressableFeedback>
              </View>
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
    maxHeight: '90%',
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
  botonesFoto: { gap: 12, marginBottom: 12 },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 999,
    padding: 14,
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  botonSecundarioTexto: { fontFamily: Fonts.bold, fontSize: 14.5, color: Colors.textPrimary },
  preview: { width: '100%', height: 220, borderRadius: 16, marginBottom: 12, backgroundColor: Colors.backgroundMuted },
  previewPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: Colors.backgroundMuted,
  },
  previewPdfTexto: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  cardsFila: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  cardDato: { flex: 1, backgroundColor: Colors.background, borderRadius: 16, padding: 12 },
  cardDatoLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardDatoInput: { fontSize: 14.5, fontFamily: Fonts.bold, color: Colors.textPrimary, padding: 0 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, marginTop: 4, fontFamily: Fonts.semibold },
  seccion: { gap: 4 },
  filaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.background,
    gap: 10,
    marginBottom: 8,
  },
  filaItemNuevo: { backgroundColor: Colors.warningTint },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActivo: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkboxNuevo: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  itemCampos: { flex: 1, gap: 4 },
  itemSub: { fontSize: 12, color: Colors.textSecondary, fontFamily: Fonts.medium },
  itemSubNuevo: { fontSize: 12, color: '#9a6b0a', fontFamily: Fonts.semibold },
  itemCamposFila: { flexDirection: 'row', gap: 8, marginTop: 4 },
  inputItemNombre: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    padding: 0,
  },
  inputItemChico: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
  },
  error: { color: Colors.error, textAlign: 'center', marginVertical: 8, fontFamily: Fonts.medium },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#c1552c',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 15.5 },
  link: { textAlign: 'center', color: Colors.primary, marginTop: 12, fontFamily: Fonts.bold, fontSize: 14 },
});
