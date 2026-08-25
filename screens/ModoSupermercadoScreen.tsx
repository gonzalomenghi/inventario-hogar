import { Check, ChevronLeft, Minus, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import AgregarItemListaModal from './AgregarItemListaModal';
import DescuentoPicker from './DescuentoPicker';
import PressableFeedback from './PressableFeedback';
import SupermercadoPicker from './SupermercadoPicker';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { supabase } from '../lib/supabase';
import type { DetalleListaItem, TipoDescuento } from '../types/database.types';

interface DescuentoEdicion {
  tipo: TipoDescuento;
  valor: string;
}

type AccionSalida = 'cancelar' | 'eliminar' | null;

function labelDescuento(tipo: TipoDescuento, valor: string): string {
  switch (tipo) {
    case '2x1':
      return '2x1';
    case 'nxm':
      return valor ? `${valor}x${Number(valor) - 1}` : 'la promo';
    case 'porcentaje':
      return valor ? `${valor}% off` : 'el descuento';
    case 'monto_fijo':
      return valor ? `el cupón de $${valor}` : 'el cupón';
    case 'descuento_2da_unidad':
      return valor ? `${valor}% en la 2da unidad` : 'la promo';
    default:
      return 'la promo';
  }
}

// Persiste el precio tipeado 600ms después de la última tecla, tanto en
// filas pendientes como ya compradas (antes solo se mandaba a la base al
// tildar el check, así que precio_estimado —columna generada en
// Postgres— nunca se recalculaba mientras el ítem seguía pendiente).
// Compara contra el precio ya guardado para no disparar un guardado
// espurio apenas se monta la fila con el valor que ya tenía.
function usePrecioDebounced(
  precioTexto: string,
  precioActual: number | null,
  onGuardarPrecio: (precio: number | null) => void
) {
  useEffect(() => {
    const id = setTimeout(() => {
      const parsed = precioTexto.trim() ? parseFloat(precioTexto.replace(',', '.')) : null;
      if (parsed != null && Number.isNaN(parsed)) return;
      if (parsed === precioActual) return;
      onGuardarPrecio(parsed);
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se re-dispara con cada tecla, que es lo que importa acá
  }, [precioTexto]);
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
  const [supermercadoListaNombre, setSupermercadoListaNombre] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmSalirVisible, setConfirmSalirVisible] = useState(false);
  // Los dos botones del confirm comparten un solo modal, pero cada uno
  // necesita su propio spinner — con un booleano ambos se verían "en
  // curso" a la vez aunque solo se haya tocado uno.
  const [accionSalida, setAccionSalida] = useState<AccionSalida>(null);

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
      .select('supermercado_id, supermercados(nombre)')
      .eq('id', listaId)
      .single();

    const fila = data as { supermercado_id: string | null; supermercados: { nombre: string } | null } | null;
    setSupermercadoListaId(fila?.supermercado_id ?? null);
    setSupermercadoListaNombre(fila?.supermercados?.nombre ?? null);
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
    setAccionSalida('cancelar');
    const { error } = await supabase
      .from('listas_compra')
      .update({ estado: 'cancelada' })
      .eq('id', listaId);
    setAccionSalida(null);

    if (!error) {
      setConfirmSalirVisible(false);
      onSalir();
    }
  };

  const eliminarLista = async () => {
    setAccionSalida('eliminar');
    const { error } = await supabase.from('listas_compra').delete().eq('id', listaId);
    setAccionSalida(null);

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

    await supabase
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

    // Siempre refetch (no solo si falla): precio_final y precio_historico_id
    // los calcula el trigger del lado del servidor, la actualización
    // optimista de arriba no los conoce — sin este refetch quedaban en
    // null hasta el próximo refresh disparado por otra acción, y el ítem
    // recién comprado aportaba $0 al total aunque tuviera precio cargado.
    fetchDetalle();
  };

  // Editable para permitir llevar más o menos que el mínimo sugerido por
  // la auto-generación (fn_generar_lista_compra_interna calcula
  // stock_minimo - cantidad_actual, pero es solo un punto de partida).
  // No baja de 1 — "0 unidades" no tiene sentido en una lista de compras.
  const ajustarCantidadSolicitada = async (item: DetalleListaItem, delta: number) => {
    const nuevaCantidad = Math.max(item.cantidad_solicitada + delta, 1);

    setDetalle((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, cantidad_solicitada: nuevaCantidad } : it))
    );

    const { error } = await supabase
      .from('detalle_lista')
      .update({ cantidad_solicitada: nuevaCantidad })
      .eq('id', item.id);

    if (error) fetchDetalle(); // revertir UI optimista si falla
  };

  // Persiste precio/descuento/supermercado apenas se editan, para ítems
  // pendientes Y ya comprados — antes solo se mandaban a la base al tildar
  // el check (marcarComprado), así que el campo de precio quedaba "vivo"
  // solo en estado local y el total estimado (que lee precio_estimado,
  // columna generada en Postgres) se quedaba en $0 hasta comprar algo.
  // Refetchea al terminar para traer precio_estimado/precio_final ya
  // recalculados por la base (no se reimplementa esa fórmula acá).
  const guardarCampo = async (
    item: DetalleListaItem,
    patch: Partial<
      Pick<DetalleListaItem, 'precio_unitario' | 'tipo_descuento' | 'valor_descuento' | 'supermercado_id'>
    >
  ) => {
    const { error } = await supabase.from('detalle_lista').update(patch).eq('id', item.id);
    if (!error) fetchDetalle();
  };

  // Volver un ítem ya tildado a pendiente (por si se marcó por error). El
  // trigger fn_comprar_item_lista se encarga de restar lo sumado a
  // inventario_hogar y borrar el registro de precios_historico que había
  // creado — acá solo se manda comprado:false, nada de esa reversión se
  // reimplementa en el frontend.
  const revertirCompra = async (item: DetalleListaItem) => {
    setDetalle((prev) => prev.map((it) => (it.id === item.id ? { ...it, comprado: false } : it)));
    await supabase.from('detalle_lista').update({ comprado: false }).eq('id', item.id);
    fetchDetalle(); // trae cantidad_comprada/precio_final/precio_historico_id ya limpiados por el trigger
  };

  // Props compartidas entre FilaPendiente y FilaComprada (ambas editan
  // precio/descuento/supermercado con el mismo mecanismo) — evita repetir
  // la misma derivación en los dos lugares donde se renderiza un ítem.
  const camposEditables = (item: DetalleListaItem) => ({
    abierto: expandido.has(item.id),
    onToggle: () => toggleExpandido(item.id),
    precioTexto: precioEnEdicion[item.id] ?? (item.precio_unitario != null ? String(item.precio_unitario) : ''),
    onCambiarPrecio: (t: string) => setPrecioEnEdicion((prev) => ({ ...prev, [item.id]: t })),
    onGuardarPrecio: (precio: number | null) => guardarCampo(item, { precio_unitario: precio }),
    descuento: descuentoEnEdicion[item.id] ?? {
      tipo: item.tipo_descuento,
      valor: item.valor_descuento != null ? String(item.valor_descuento) : '',
    },
    onCambiarDescuento: (d: DescuentoEdicion) => {
      setDescuentoEnEdicion((prev) => ({ ...prev, [item.id]: d }));
      guardarCampo(item, {
        tipo_descuento: d.tipo,
        valor_descuento: d.valor.trim() ? parseFloat(d.valor.replace(',', '.')) : null,
      });
    },
    supermercadoId: item.id in supermercadoEnEdicion ? supermercadoEnEdicion[item.id] : item.supermercado_id,
    onCambiarSupermercado: (id: string) => {
      setSupermercadoEnEdicion((prev) => ({ ...prev, [item.id]: id }));
      guardarCampo(item, { supermercado_id: id });
    },
  });

  const pendientes = detalle.filter((d) => !d.comprado);
  const comprados = detalle.filter((d) => d.comprado);

  // precio_final (ítems ya comprados) y precio_estimado (pendientes, columna
  // generada en Postgres con la misma fórmula de descuento) ya vienen
  // calculados desde la base — acá solo se suman, no se reimplementa la
  // fórmula de descuento en el frontend. Los ítems sin precio cargado
  // todavía no entran a la suma, pero sí se cuentan para avisar que el
  // total es parcial.
  let totalEstimado = 0;
  let itemsSinPrecio = 0;
  for (const item of detalle) {
    const precio = item.comprado ? item.precio_final : item.precio_estimado;
    if (precio == null) {
      itemsSinPrecio += 1;
      continue;
    }
    const cantidad = item.comprado ? item.cantidad_comprada ?? item.cantidad_solicitada : item.cantidad_solicitada;
    totalEstimado += precio * cantidad;
  }

  const progreso = detalle.length > 0 ? comprados.length / detalle.length : 0;

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
        <PressableFeedback
          style={styles.botonVolver}
          onPress={() => setConfirmSalirVisible(true)}
          accessibilityLabel="Salir de la lista"
        >
          <ChevronLeft size={20} color={Colors.primary} strokeWidth={2.75} />
        </PressableFeedback>
        <View>
          <Text style={styles.kicker}>Modo supermercado</Text>
          <Text style={styles.titulo}>
            {supermercadoListaNombre ? `Compra en ${supermercadoListaNombre}` : 'Lista de compras'}
          </Text>
        </View>
      </View>

      <View style={styles.cardProgreso}>
        <View style={styles.cardProgresoFila}>
          <Text style={styles.cardProgresoTexto}>
            {comprados.length} de {detalle.length} en el changuito
          </Text>
          <View style={styles.cardProgresoTotal}>
            <Text style={styles.cardProgresoMonto}>${totalEstimado.toFixed(0)}</Text>
            <Text style={styles.cardProgresoEstimado}>estimado</Text>
          </View>
        </View>
        <View style={styles.barraTrack}>
          <LinearGradient
            colors={['#c1552c', '#e0784a']}
            style={[styles.barraFill, { width: `${Math.max(progreso * 100, progreso > 0 ? 4 : 0)}%` }]}
          />
        </View>
        {itemsSinPrecio > 0 && (
          <Text style={styles.cardProgresoNota}>{itemsSinPrecio} sin precio cargado</Text>
        )}
      </View>

      <FlatList
        data={pendientes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <FilaPendiente
            item={item}
            {...camposEditables(item)}
            onComprar={() => marcarComprado(item)}
            onAjustarCantidad={(delta) => ajustarCantidadSolicitada(item, delta)}
          />
        )}
        ListFooterComponent={
          comprados.length > 0 ? (
            <View>
              <View style={styles.separador}>
                <View style={styles.separadorLinea} />
                <Text style={styles.separadorTexto}>EN EL CHANGUITO · {comprados.length}</Text>
                <View style={styles.separadorLinea} />
              </View>
              {comprados.map((item) => (
                <FilaComprada key={item.id} item={item} {...camposEditables(item)} onRevertir={() => revertirCompra(item)} />
              ))}
            </View>
          ) : null
        }
      />

      <PressableFeedback
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Agregar producto a la lista"
      >
        <Text style={styles.fabTexto}>+</Text>
      </PressableFeedback>

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

            <PressableFeedback
              style={[styles.confirmBoton, accionSalida !== null && styles.botonDisabled]}
              onPress={cancelarLista}
              disabled={accionSalida !== null}
            >
              {accionSalida === 'cancelar' ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.confirmBotonTexto}>Cancelar lista y salir</Text>
              )}
            </PressableFeedback>

            <PressableFeedback
              style={[styles.confirmBotonDestructivo, accionSalida !== null && styles.botonDisabled]}
              onPress={eliminarLista}
              disabled={accionSalida !== null}
            >
              {accionSalida === 'eliminar' ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.confirmBotonDestructivoTexto}>Eliminar lista y sus ítems</Text>
              )}
            </PressableFeedback>

            <PressableFeedback
              style={styles.confirmVolver}
              onPress={() => setConfirmSalirVisible(false)}
              disabled={accionSalida !== null}
            >
              <Text style={styles.confirmVolverTexto}>Volver</Text>
            </PressableFeedback>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilaPendiente({
  item,
  abierto,
  onToggle,
  precioTexto,
  onCambiarPrecio,
  onGuardarPrecio,
  descuento,
  onCambiarDescuento,
  supermercadoId,
  onCambiarSupermercado,
  onComprar,
  onAjustarCantidad,
}: {
  item: DetalleListaItem;
  abierto: boolean;
  onToggle: () => void;
  precioTexto: string;
  onCambiarPrecio: (t: string) => void;
  onGuardarPrecio: (precio: number | null) => void;
  descuento: DescuentoEdicion;
  onCambiarDescuento: (d: DescuentoEdicion) => void;
  supermercadoId: string | null;
  onCambiarSupermercado: (id: string) => void;
  onComprar: () => void;
  onAjustarCantidad: (delta: number) => void;
}) {
  const [hoverCheckbox, setHoverCheckbox] = useState(false);
  usePrecioDebounced(precioTexto, item.precio_unitario, onGuardarPrecio);
  // Preview de ahorro: se pide el cálculo real a Postgres (misma fórmula
  // que fn_comprar_item_lista/precio_estimado) en vez de reimplementarlo
  // acá — solo se dispara mientras hay precio + descuento cargados y el
  // panel está abierto, con un debounce corto.
  const [precioConDescuento, setPrecioConDescuento] = useState<number | null>(null);

  useEffect(() => {
    const precio = parseFloat(precioTexto.replace(',', '.'));
    if (!abierto || !precioTexto.trim() || Number.isNaN(precio) || descuento.tipo === 'ninguno') {
      setPrecioConDescuento(null);
      return;
    }

    const valor = descuento.valor.trim() ? parseFloat(descuento.valor.replace(',', '.')) : null;
    const id = setTimeout(async () => {
      // El tipado generado marca p_valor_descuento como no-nullable, pero la
      // función SQL sí acepta null (coalesce interno, ej. '2x1' no lo usa).
      const { data } = await supabase.rpc('fn_calcular_precio_final', {
        p_precio_unitario: precio,
        p_tipo_descuento: descuento.tipo,
        p_valor_descuento: valor as number,
      });
      setPrecioConDescuento(typeof data === 'number' ? data : null);
    }, 300);

    return () => clearTimeout(id);
  }, [abierto, precioTexto, descuento.tipo, descuento.valor]);

  const precioOriginal = parseFloat(precioTexto.replace(',', '.'));
  const mostrarPreview =
    precioConDescuento != null && !Number.isNaN(precioOriginal) && precioConDescuento < precioOriginal;
  const ahorro = mostrarPreview ? (precioOriginal - precioConDescuento) * item.cantidad_solicitada : 0;

  return (
    <View style={styles.row}>
      <View style={styles.filaPrincipal}>
        <PressableFeedback
          style={[styles.checkbox, hoverCheckbox && styles.checkboxHover]}
          onPress={onComprar}
          onHoverIn={() => setHoverCheckbox(true)}
          onHoverOut={() => setHoverCheckbox(false)}
          accessibilityLabel={`Marcar comprado: ${item.producto?.nombre}`}
        />

        <View style={styles.info}>
          <Text style={styles.nombre}>{item.producto?.nombre}</Text>
          <View style={styles.cantidadStepper}>
            <PressableFeedback
              style={({ pressed }) => [styles.cantidadBoton, pressed && styles.cantidadBotonPressed]}
              onPress={() => onAjustarCantidad(-1)}
              accessibilityLabel={`Restar unidad a ${item.producto?.nombre}`}
            >
              <Minus size={11} color={Colors.textSecondary} strokeWidth={2.75} />
            </PressableFeedback>
            <Text style={styles.cantidad}>
              {item.cantidad_solicitada} {item.producto?.unidad_medida}
            </Text>
            <PressableFeedback
              style={({ pressed }) => [styles.cantidadBoton, pressed && styles.cantidadBotonPressed]}
              onPress={() => onAjustarCantidad(1)}
              accessibilityLabel={`Sumar unidad a ${item.producto?.nombre}`}
            >
              <Plus size={11} color={Colors.textSecondary} strokeWidth={2.75} />
            </PressableFeedback>
          </View>
        </View>

        <TextInput
          style={[styles.inputPrecio, !precioTexto && styles.inputPrecioVacio]}
          placeholder="—"
          placeholderTextColor="#d8c2ae"
          keyboardType="decimal-pad"
          value={precioTexto}
          onChangeText={onCambiarPrecio}
        />
        <PressableFeedback
          style={styles.botonExpandir}
          onPress={onToggle}
          accessibilityLabel={`Más opciones para ${item.producto?.nombre}`}
        >
          <Text style={styles.botonExpandirTexto}>{abierto ? '︿' : '⋯'}</Text>
        </PressableFeedback>
      </View>

      {abierto && (
        <Animated.View
          style={styles.expansion}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          layout={LinearTransition.duration(200)}
        >
          <Text style={styles.label}>Descuento</Text>
          <DescuentoPicker
            tipo={descuento.tipo}
            valor={descuento.valor}
            onChange={(tipo, valor) => onCambiarDescuento({ tipo, valor })}
          />

          {mostrarPreview && (
            <View style={styles.previewAhorro}>
              <Check size={15} color={Colors.successTintText} strokeWidth={2.75} />
              <Text style={styles.previewAhorroTexto}>
                Con {labelDescuento(descuento.tipo, descuento.valor)} pagás $
                {(precioConDescuento! * item.cantidad_solicitada).toFixed(0)} — ahorrás ${ahorro.toFixed(0)}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Supermercado</Text>
          <SupermercadoPicker value={supermercadoId} onChange={onCambiarSupermercado} />
        </Animated.View>
      )}
    </View>
  );
}

// Precio/descuento/supermercado siguen editables después de comprado: lo
// cargado antes de pasar por caja suele ser una estimación, y acá se
// corrige por el precio real del ticket. fn_comprar_item_lista recalcula
// precio_final y actualiza (no duplica) el registro de precios_historico
// ya creado — el frontend solo manda el patch, igual que en FilaPendiente.
function FilaComprada({
  item,
  abierto,
  onToggle,
  precioTexto,
  onCambiarPrecio,
  onGuardarPrecio,
  descuento,
  onCambiarDescuento,
  supermercadoId,
  onCambiarSupermercado,
  onRevertir,
}: {
  item: DetalleListaItem;
  abierto: boolean;
  onToggle: () => void;
  precioTexto: string;
  onCambiarPrecio: (t: string) => void;
  onGuardarPrecio: (precio: number | null) => void;
  descuento: DescuentoEdicion;
  onCambiarDescuento: (d: DescuentoEdicion) => void;
  supermercadoId: string | null;
  onCambiarSupermercado: (id: string) => void;
  onRevertir: () => void;
}) {
  usePrecioDebounced(precioTexto, item.precio_unitario, onGuardarPrecio);

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      layout={LinearTransition.duration(200)}
      style={[styles.row, styles.rowComprada]}
    >
      <View style={styles.filaPrincipal}>
        <PressableFeedback
          style={styles.checkboxLleno}
          onPress={onRevertir}
          accessibilityLabel={`Volver a pendiente: ${item.producto?.nombre}`}
        >
          <Check size={14} color={Colors.white} strokeWidth={3} />
        </PressableFeedback>
        <View style={styles.info}>
          <Text style={styles.nombreComprado}>{item.producto?.nombre}</Text>
          <Text style={styles.cantidad}>
            {item.cantidad_comprada ?? item.cantidad_solicitada} {item.producto?.unidad_medida}
          </Text>
        </View>

        <TextInput
          style={[styles.inputPrecio, !precioTexto && styles.inputPrecioVacio]}
          placeholder="—"
          placeholderTextColor="#d8c2ae"
          keyboardType="decimal-pad"
          value={precioTexto}
          onChangeText={onCambiarPrecio}
        />
        <PressableFeedback
          style={styles.botonExpandir}
          onPress={onToggle}
          accessibilityLabel={`Más opciones para ${item.producto?.nombre}`}
        >
          <Text style={styles.botonExpandirTexto}>{abierto ? '︿' : '⋯'}</Text>
        </PressableFeedback>
      </View>

      {abierto && (
        <Animated.View
          style={styles.expansion}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          layout={LinearTransition.duration(200)}
        >
          <Text style={styles.label}>Descuento</Text>
          <DescuentoPicker
            tipo={descuento.tipo}
            valor={descuento.valor}
            onChange={(tipo, valor) => onCambiarDescuento({ tipo, valor })}
          />

          <Text style={styles.label}>Supermercado</Text>
          <SupermercadoPicker value={supermercadoId} onChange={onCambiarSupermercado} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

// 'fixed' en vez de 'absolute' en web: en RN Web, 'absolute' se posiciona
// relativo al contenedor scrolleable de contenido, no al viewport — con
// una lista larga el FAB terminaba scrolleando con el contenido en vez de
// quedar flotando fijo. En nativo funciona bien con 'absolute'.
const posicionFlotante = Platform.select({ web: 'fixed', default: 'absolute' }) as 'absolute';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 12,
  },
  botonVolver: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  kicker: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.textSecondary },
  titulo: { fontFamily: Fonts.bold, fontSize: 19, color: Colors.textPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardProgreso: {
    backgroundColor: '#2a1e1a',
    borderRadius: 22,
    padding: 16,
    paddingHorizontal: 18,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  cardProgresoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardProgresoTexto: { fontFamily: Fonts.semibold, fontSize: 13, color: '#cbb5a5' },
  cardProgresoTotal: { alignItems: 'flex-end' },
  cardProgresoMonto: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.white },
  cardProgresoEstimado: { fontFamily: Fonts.medium, fontSize: 12, color: '#cbb5a5' },
  cardProgresoNota: { fontFamily: Fonts.medium, fontSize: 11.5, color: '#cbb5a5', marginTop: 6 },
  barraTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 12,
    overflow: 'hidden',
  },
  barraFill: { height: '100%', borderRadius: 999 },
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  row: {
    backgroundColor: Colors.white,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 6,
  },
  rowComprada: { backgroundColor: 'rgba(255,255,255,0.6)' },
  filaPrincipal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: Colors.border,
  },
  checkboxHover: { borderColor: Colors.success },
  checkboxLleno: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  nombre: { fontFamily: Fonts.semibold, fontSize: 15.5, color: Colors.textPrimary },
  nombreComprado: {
    fontFamily: Fonts.semibold,
    fontSize: 15.5,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  cantidad: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary },
  cantidadStepper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cantidadBoton: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidadBotonPressed: { backgroundColor: '#dfc6a8' },
  inputPrecio: {
    minWidth: 64,
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  inputPrecioVacio: { color: '#d8c2ae' },
  botonExpandir: { paddingHorizontal: 6, paddingVertical: 6 },
  botonExpandirTexto: { fontSize: 16, color: Colors.textSecondary, fontFamily: Fonts.bold },
  expansion: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundMuted,
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewAhorro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successTint,
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  previewAhorroTexto: { flex: 1, fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.successTintText },
  separador: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 8 },
  separadorLinea: { flex: 1, height: 1, backgroundColor: Colors.border },
  separadorTexto: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fab: {
    position: posicionFlotante,
    right: 20,
    bottom: 86, // deja lugar a la tab bar flotante (~76-90px), si no queda tapado detrás
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c1552c',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabTexto: { color: Colors.white, fontSize: 26, fontFamily: Fonts.bold, lineHeight: 28 },
  botonDisabled: { opacity: 0.5 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42,30,26,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  confirmSheet: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  confirmTitulo: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6 },
  confirmBoton: {
    backgroundColor: Colors.background,
    borderRadius: 999,
    padding: 13,
    alignItems: 'center',
  },
  confirmBotonTexto: { color: Colors.textPrimary, fontFamily: Fonts.semibold },
  confirmBotonDestructivo: {
    backgroundColor: Colors.error,
    borderRadius: 999,
    padding: 13,
    alignItems: 'center',
  },
  confirmBotonDestructivoTexto: { color: Colors.white, fontFamily: Fonts.bold },
  confirmVolver: { alignItems: 'center', paddingTop: 4 },
  confirmVolverTexto: { color: Colors.textSecondary, fontFamily: Fonts.semibold },
});
