import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useEscanearTicket } from '../hooks/useEscanearTicket';
import { supabase } from '../lib/supabase';
import type { TablesInsert } from '../types/database.types';

interface ItemEditable {
  nombre: string;
  cantidad: string;
  precioFinal: string;
  incluido: boolean;
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

  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('image/jpeg');
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const [items, setItems] = useState<ItemEditable[] | null>(null);
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

    setItems(
      resultado.items.map((item) => ({
        nombre: item.nombre,
        cantidad: String(item.cantidad),
        precioFinal: String(item.precio_final),
        incluido: true,
      }))
    );
    if (resultado.supermercado_sugerido) setSupermercadoNombre(resultado.supermercado_sugerido);
    if (resultado.fecha_sugerida) setFecha(resultado.fecha_sugerida);
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
      const { data: existente } = await supabase
        .from('supermercados')
        .select('id')
        .eq('nombre', nombreSuper)
        .maybeSingle();

      if (existente) {
        supermercadoId = (existente as { id: string }).id;
      } else {
        const nuevoSuper: TablesInsert<'supermercados'> = {
          user_id: session.user.id,
          nombre: nombreSuper,
        };
        const { data: creado, error: errorSuper } = await supabase
          .from('supermercados')
          .insert(nuevoSuper)
          .select('id')
          .single();

        if (errorSuper || !creado) {
          setError(errorSuper?.message ?? 'No se pudo guardar el supermercado.');
          setGuardando(false);
          return;
        }
        supermercadoId = creado.id;
      }
    }

    // Esta pantalla no tiene selector de categoría (el ticket no la trae),
    // así que un producto detectado que no matchea nada existente se crea
    // en "Alimentos" por defecto. Se resuelve una sola vez acá, no por
    // cada ítem del ticket.
    let categoriaAlimentosId: string | null = null;
    const itemsAIncluir = items.filter((it) => it.incluido);
    const necesitaCategoriaDefault = itemsAIncluir.length > 0;

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
      const { data: matches } = await supabase.rpc('buscar_producto_similar', {
        texto_busqueda: item.nombre,
        limite: 1,
      });

      const mejorMatch = matches?.[0];
      let productoId: string;
      let unidadMedida: string;

      if (mejorMatch && mejorMatch.origen === 'propio' && mejorMatch.id) {
        productoId = mejorMatch.id;
        unidadMedida = mejorMatch.unidad_medida ?? 'unidad';
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.titulo}>Escanear ticket</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.cerrar}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {!items && (
              <>
                {imagenUri ? (
                  <Image source={{ uri: imagenUri }} style={styles.preview} resizeMode="contain" />
                ) : nombreArchivo ? (
                  <View style={styles.previewPdf}>
                    <Text style={styles.previewPdfTexto}>📄 {nombreArchivo}</Text>
                  </View>
                ) : (
                  <View style={styles.botonesFoto}>
                    <Pressable style={styles.botonSecundario} onPress={() => elegirImagen(true)}>
                      <Text style={styles.botonSecundarioTexto}>📷 Sacar foto</Text>
                    </Pressable>
                    <Pressable style={styles.botonSecundario} onPress={() => elegirImagen(false)}>
                      <Text style={styles.botonSecundarioTexto}>🖼️ Elegir de galería</Text>
                    </Pressable>
                    <Pressable style={styles.botonSecundario} onPress={elegirPDF}>
                      <Text style={styles.botonSecundarioTexto}>📄 Elegir PDF</Text>
                    </Pressable>
                  </View>
                )}

                {(error || errorProcesar) && (
                  <Text style={styles.error}>{error ?? errorProcesar}</Text>
                )}

                {imagenBase64 && (
                  <>
                    <Pressable
                      style={[styles.boton, procesando && styles.botonDisabled]}
                      onPress={procesar}
                      disabled={procesando}
                    >
                      {procesando ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.botonTexto}>Procesar ticket</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setImagenUri(null);
                        setImagenBase64(null);
                        setNombreArchivo(null);
                      }}
                    >
                      <Text style={styles.link}>Elegir otro archivo</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {items && (
              <View style={styles.seccion}>
                <Text style={styles.label}>Supermercado (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={supermercadoNombre}
                  onChangeText={setSupermercadoNombre}
                  placeholder="Coto, Dia, Carrefour..."
                />

                <Text style={styles.label}>Fecha</Text>
                <TextInput
                  style={styles.input}
                  value={fecha}
                  onChangeText={setFecha}
                  placeholder="AAAA-MM-DD"
                />

                <Text style={styles.label}>Ítems detectados ({items.length})</Text>
                {items.map((item, i) => (
                  <View key={i} style={styles.filaItem}>
                    <Pressable
                      style={[styles.checkbox, item.incluido && styles.checkboxActivo]}
                      onPress={() => actualizarItem(i, { incluido: !item.incluido })}
                    >
                      {item.incluido && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>

                    <View style={styles.itemCampos}>
                      <TextInput
                        style={styles.inputItemNombre}
                        value={item.nombre}
                        onChangeText={(t) => actualizarItem(i, { nombre: t })}
                      />
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
                ))}

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  style={[styles.boton, guardando && styles.botonDisabled]}
                  onPress={confirmarYGuardar}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.botonTexto}>Sumar al inventario y guardar precios</Text>
                  )}
                </Pressable>
              </View>
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
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titulo: { fontSize: 18, fontWeight: '700' },
  cerrar: { color: Colors.primary, fontWeight: '600' },
  botonesFoto: { gap: 12, marginBottom: 12 },
  botonSecundario: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  botonSecundarioTexto: { fontWeight: '600', fontSize: 15 },
  preview: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12, backgroundColor: Colors.backgroundMuted },
  previewPdf: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
  },
  previewPdfTexto: { fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  seccion: { gap: 4 },
  filaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.backgroundMuted,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActivo: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkmark: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  itemCampos: { flex: 1, gap: 6 },
  itemCamposFila: { flexDirection: 'row', gap: 8 },
  inputItemNombre: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  inputItemChico: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  error: { color: Colors.error, textAlign: 'center', marginVertical: 8 },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: Colors.primary, marginTop: 12 },
});
