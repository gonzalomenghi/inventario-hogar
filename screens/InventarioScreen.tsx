import { useRouter } from 'expo-router';
import { Camera, ChevronDown, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AgregarProductoModal from './AgregarProductoModal';
import DetalleProductoModal from './DetalleProductoModal';
import EscanearTicketModal from './EscanearTicketModal';
import GraficoGastoMensual from './GraficoGastoMensual';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useAuth } from '../hooks/useAuth';
import { useCategorias } from '../hooks/useCategorias';
import { useDashboardAhorro } from '../hooks/useDashboardAhorro';
import { useInventario } from '../hooks/useInventario';
import { supabase } from '../lib/supabase';
import type { EstadoStock, InventarioItem } from '../types/database.types';

const DESKTOP_BREAKPOINT = 1024;

const COLOR_SEMAFORO: Record<EstadoStock, string> = {
  rojo: Colors.error,
  amarillo: Colors.warning,
  verde: Colors.success,
};
const TINT_SEMAFORO: Record<EstadoStock, string> = {
  rojo: Colors.errorTint,
  amarillo: Colors.warningTint,
  verde: Colors.successTint,
};

function formatoFechaCorta(fechaIso: string) {
  const [, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}`;
}

export default function InventarioScreen() {
  const { items, loading, error, ajustarCantidad, refetch } = useInventario();
  const { categorias } = useCategorias();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTicketVisible, setModalTicketVisible] = useState(false);
  const [detalleItem, setDetalleItem] = useState<InventarioItem | null>(null);
  // Efímero, sin persistir: son pocas categorías, re-expandir cuesta un
  // tap y persistir agregaría un read async al montar para poco beneficio.
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const secciones = useMemo(() => {
    return categorias
      .map((cat) => ({
        id: cat.id,
        icono: cat.icono,
        nombre: cat.nombre,
        items: items.filter((it) => it.producto?.categoria_id === cat.id),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [items, categorias]);

  const resumen = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of items) {
      if (item.estado_stock === 'rojo') rojo++;
      else if (item.estado_stock === 'amarillo') amarillo++;
      else verde++;
    }
    return { rojo, amarillo, verde };
  }, [items]);

  const toggleColapsada = (categoriaId: string) => {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(categoriaId)) next.delete(categoriaId);
      else next.add(categoriaId);
      return next;
    });
  };

  const contenido = loading ? (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
    </View>
  ) : error ? (
    <View style={styles.centered}>
      <Text style={styles.errorText}>No se pudo cargar el inventario: {error}</Text>
    </View>
  ) : items.length === 0 ? (
    <View style={styles.centered}>
      <Text style={styles.mensajeVacio}>Todavía no cargaste productos. Usá el botón + para empezar.</Text>
    </View>
  ) : (
    <View style={isDesktop ? styles.listaDesktop : styles.listaMobile}>
      {secciones.map((sec) => (
        <SeccionCard
          key={sec.id}
          icono={sec.icono}
          nombre={sec.nombre}
          items={sec.items}
          colapsada={colapsadas.has(sec.id)}
          onToggle={() => toggleColapsada(sec.id)}
          onAjustar={ajustarCantidad}
          onDetalle={setDetalleItem}
          columnas={isDesktop ? 2 : 1}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {isDesktop ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContentDesktop}>
          <View style={styles.desktopWrap}>
            <View style={styles.desktopHeader}>
              <View>
                <Text style={styles.desktopTitulo}>Tu inventario</Text>
                <Text style={styles.desktopSubtitulo}>
                  {items.length} {items.length === 1 ? 'producto' : 'productos'} en {secciones.length}{' '}
                  {secciones.length === 1 ? 'categoría' : 'categorías'}
                </Text>
              </View>
              <View style={styles.desktopBotones}>
                <PressableFeedback
                  style={styles.botonSecundario}
                  onPress={() => setModalTicketVisible(true)}
                >
                  <Camera size={17} color={Colors.primary} strokeWidth={2.75} />
                  <Text style={styles.botonSecundarioTexto}>Escanear ticket</Text>
                </PressableFeedback>
                <PressableFeedback style={styles.botonPrimario} onPress={() => setModalVisible(true)}>
                  <Plus size={17} color={Colors.white} strokeWidth={2.75} />
                  <Text style={styles.botonPrimarioTexto}>Agregar producto</Text>
                </PressableFeedback>
              </View>
            </View>

            <View style={styles.desktopGrid}>
              <View style={styles.desktopColumna}>{contenido}</View>
              <RailDerecho items={items} />
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContentMobile}>
            <HeaderMobile />
            {!loading && !error && items.length > 0 && <ChipsResumen resumen={resumen} />}
            {contenido}
          </ScrollView>

          <PressableFeedback
            style={styles.fabTicket}
            onPress={() => setModalTicketVisible(true)}
            accessibilityLabel="Escanear ticket"
          >
            <Camera size={20} color={Colors.primary} strokeWidth={2.75} />
          </PressableFeedback>

          <PressableFeedback
            style={styles.fab}
            onPress={() => setModalVisible(true)}
            accessibilityLabel="Agregar producto"
          >
            <Plus size={26} color={Colors.white} strokeWidth={2.75} />
          </PressableFeedback>
        </>
      )}

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

      <DetalleProductoModal
        visible={!!detalleItem}
        item={detalleItem}
        onClose={() => setDetalleItem(null)}
        onGuardado={refetch}
      />
    </View>
  );
}

function HeaderMobile() {
  return (
    <View style={styles.headerMobile}>
      <View style={styles.headerMobileTextos}>
        <Text style={styles.kicker}>Tu alacena</Text>
        <Text style={styles.tituloMobile}>Inventario</Text>
      </View>
      <Avatar />
    </View>
  );
}

function Avatar() {
  // Sin campo de nombre en el perfil (solo email) — inicial simple en vez
  // de inventar dos iniciales que no existen.
  const { session } = useAuth();
  const inicial = session?.user.email?.[0]?.toUpperCase() ?? '?';
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarTexto}>{inicial}</Text>
    </View>
  );
}

function ChipsResumen({ resumen }: { resumen: { rojo: number; amarillo: number; verde: number } }) {
  return (
    <View style={styles.chipsResumen}>
      <Chip color={Colors.error} tint={Colors.errorTint} texto={`${resumen.rojo} para reponer`} />
      <Chip color={Colors.warning} tint={Colors.warningTint} texto={`${resumen.amarillo} justos`} />
      <Chip color={Colors.success} tint={Colors.successTint} texto={`${resumen.verde} ok`} />
    </View>
  );
}

function Chip({ color, tint, texto }: { color: string; tint: string; texto: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: tint }]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipTexto, { color }]}>{texto}</Text>
    </View>
  );
}

// Componente propio (no una función inline en el render) porque necesita
// su propio useSharedValue por sección — un render-prop plano no puede
// usar hooks de forma consistente entre renders.
function SeccionCard({
  icono,
  nombre,
  items,
  colapsada,
  onToggle,
  onAjustar,
  onDetalle,
  columnas,
}: {
  icono: string;
  nombre: string;
  items: InventarioItem[];
  colapsada: boolean;
  onToggle: () => void;
  onAjustar: (id: string, delta: number) => void;
  onDetalle: (item: InventarioItem) => void;
  columnas: 1 | 2;
}) {
  const rotacion = useSharedValue(colapsada ? -90 : 0);

  useEffect(() => {
    rotacion.value = withTiming(colapsada ? -90 : 0, { duration: 200 });
  }, [colapsada, rotacion]);

  const estiloChevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotacion.value}deg` }],
  }));

  return (
    <View style={styles.card}>
      <PressableFeedback style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionHeaderIcono}>
          <Text style={styles.sectionHeaderEmoji}>{icono}</Text>
        </View>
        <Text style={styles.sectionHeaderTexto}>{nombre}</Text>
        <View style={styles.sectionHeaderBadge}>
          <Text style={styles.sectionHeaderBadgeTexto}>{items.length}</Text>
        </View>
        <Animated.View style={estiloChevron}>
          <ChevronDown size={17} color={Colors.textSecondary} strokeWidth={2.75} />
        </Animated.View>
      </PressableFeedback>

      {!colapsada && (
        <View style={[styles.sectionItems, columnas === 2 && styles.sectionItemsGrid]}>
          {items.map((item) => (
            <ItemInventario
              key={item.id}
              item={item}
              onAjustar={onAjustar}
              onDetalle={onDetalle}
              ancho={columnas === 2 ? '48%' : '100%'}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ItemInventario({
  item,
  onAjustar,
  onDetalle,
  ancho,
}: {
  item: InventarioItem;
  onAjustar: (id: string, delta: number) => void;
  onDetalle: (item: InventarioItem) => void;
  ancho: '48%' | '100%';
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.duration(200)}
      style={{ width: ancho }}
    >
      <PressableFeedback style={styles.fila} onPress={() => onDetalle(item)}>
        <View style={[styles.semaforoHalo, { backgroundColor: TINT_SEMAFORO[item.estado_stock] }]}>
          <View style={[styles.semaforoDot, { backgroundColor: COLOR_SEMAFORO[item.estado_stock] }]} />
        </View>

        <View style={styles.info}>
          <Text style={styles.nombre} numberOfLines={1}>
            {item.producto?.nombre}
          </Text>
          <Text style={styles.cantidadMeta} numberOfLines={1}>
            {item.cantidad_actual} {item.unidad_medida}
            {item.fecha_vencimiento ? ` · vence ${formatoFechaCorta(item.fecha_vencimiento)}` : ''}
          </Text>
        </View>

        <View style={styles.stepper}>
          <PressableFeedback
            style={({ pressed }) => [styles.stepperBoton, pressed && styles.stepperBotonPressed]}
            onPress={() => onAjustar(item.id, -1)}
            accessibilityLabel={`Restar unidad a ${item.producto?.nombre}`}
          >
            <Minus size={14} color={Colors.textPrimary} strokeWidth={2.75} />
          </PressableFeedback>
          <Text style={styles.stepperCantidad}>{item.cantidad_actual}</Text>
          <PressableFeedback
            style={({ pressed }) => [styles.stepperBoton, pressed && styles.stepperBotonPressed]}
            onPress={() => onAjustar(item.id, 1)}
            accessibilityLabel={`Sumar unidad a ${item.producto?.nombre}`}
          >
            <Plus size={14} color={Colors.textPrimary} strokeWidth={2.75} />
          </PressableFeedback>
        </View>
      </PressableFeedback>
    </Animated.View>
  );
}

// Rail derecho de escritorio (artboard 1k): "para reponer" + botón para
// generar la lista de compras (mismo RPC que src/app/modo-supermercado.tsx),
// gasto del mes (mismo gráfico que Historial) y alertas de precio — todo
// con datos que ya vienen de hooks existentes, sin backend nuevo.
function RailDerecho({ items }: { items: InventarioItem[] }) {
  const router = useRouter();
  const { gastoMensual, tendencias } = useDashboardAhorro();
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);

  const paraReponer = items.filter((it) => it.estado_stock !== 'verde').slice(0, 6);

  const generarLista = async () => {
    setGenerando(true);
    setErrorGenerar(null);
    const { data: listaId, error } = await supabase.rpc('fn_generar_lista_compra');
    setGenerando(false);

    if (error || !listaId) {
      setErrorGenerar(error?.message ?? 'No se pudo generar la lista.');
      return;
    }
    router.push('/modo-supermercado');
  };

  return (
    <View style={styles.rail}>
      <View style={styles.railCardOscura}>
        <Text style={styles.railTituloOscuro}>Para reponer</Text>
        {paraReponer.length === 0 ? (
          <Text style={styles.railVacio}>Todo en orden por ahora.</Text>
        ) : (
          paraReponer.map((item) => (
            <View key={item.id} style={styles.railFilaReponer}>
              <View style={[styles.railDot, { backgroundColor: COLOR_SEMAFORO[item.estado_stock] }]} />
              <Text style={styles.railFilaReponerTexto} numberOfLines={1}>
                {item.producto?.nombre}
              </Text>
            </View>
          ))
        )}

        {errorGenerar && <Text style={styles.railError}>{errorGenerar}</Text>}

        <PressableFeedback
          style={[styles.botonGenerarLista, generando && styles.botonDisabled]}
          onPress={generarLista}
          disabled={generando}
        >
          {generando ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.botonGenerarListaTexto}>Generar lista de compras</Text>
          )}
        </PressableFeedback>
      </View>

      {gastoMensual.length > 0 && (
        <View style={styles.railCard}>
          <Text style={styles.railTitulo}>Gasto del mes</Text>
          <GraficoGastoMensual gastoMensual={gastoMensual} />
        </View>
      )}

      {tendencias.length > 0 && (
        <View style={styles.railCard}>
          <Text style={styles.railTitulo}>Alertas de precio</Text>
          {tendencias.slice(0, 4).map((t) => {
            const delta = ((t.precio_actual - t.precio_anterior) / t.precio_anterior) * 100;
            return (
              <View key={t.producto_id} style={styles.railFilaAlerta}>
                <Text style={styles.railFilaAlertaTexto} numberOfLines={1}>
                  {t.producto_nombre}
                </Text>
                <View style={styles.railFilaAlertaDelta}>
                  {delta > 0 ? (
                    <TrendingUp size={13} color={Colors.error} strokeWidth={2.75} />
                  ) : (
                    <TrendingDown size={13} color={Colors.success} strokeWidth={2.75} />
                  )}
                  <Text style={[styles.railFilaAlertaDeltaTexto, { color: delta > 0 ? Colors.error : Colors.success }]}>
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(0)}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// 'fixed' en vez de 'absolute' en web: en RN Web, 'absolute' se posiciona
// relativo al contenedor scrolleable de contenido, no al viewport — con
// una lista larga el FAB terminaba scrolleando con el contenido en vez de
// quedar flotando fijo. En nativo la pantalla ya es un contenedor con
// altura real (el scroll es interno al FlatList/ScrollView), 'absolute'
// funciona bien ahí — por eso el Platform.select en vez de un valor fijo.
const posicionFlotante = Platform.select({ web: 'fixed', default: 'absolute' }) as 'absolute';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  containerDesktop: {},
  // El body de la app tiene overflow:hidden a propósito (ver
  // src/global.css) — cada pantalla necesita su propio ScrollView con
  // flex:1 para poder scrollear contenido más alto que la ventana, no
  // alcanza con un View plano. Sin esto el contenido que no entra queda
  // inalcanzable (o, en algunos navegadores, "se cuela" con el scroll
  // táctil elástico, tapando la tab bar/FABs a mitad de lista).
  scroll: { flex: 1 },
  scrollContentMobile: { paddingBottom: 110 },
  scrollContentDesktop: { alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: Colors.error, textAlign: 'center', fontFamily: Fonts.medium },
  mensajeVacio: { textAlign: 'center', color: Colors.textSecondary, fontFamily: Fonts.medium, fontSize: 15 },

  // Mobile
  headerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    paddingHorizontal: 20,
  },
  headerMobileTextos: { gap: 2 },
  kicker: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.textSecondary },
  tituloMobile: { fontFamily: Fonts.bold, fontSize: 21, color: Colors.textPrimary },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.primary },
  chipsResumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipTexto: { fontFamily: Fonts.bold, fontSize: 12.5 },
  listaMobile: { paddingHorizontal: 12 },
  fab: {
    position: posicionFlotante,
    right: 20,
    bottom: 86,
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
  fabTicket: {
    position: posicionFlotante,
    right: 24,
    bottom: 150,
    width: 46,
    height: 46,
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

  // Desktop
  desktopWrap: { width: '100%', maxWidth: 1122, padding: 24 },
  desktopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  desktopTitulo: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.textPrimary },
  desktopSubtitulo: { fontFamily: Fonts.medium, fontSize: 13.5, color: Colors.textSecondary, marginTop: 2 },
  desktopBotones: { flexDirection: 'row', gap: 10 },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 18,
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  botonSecundarioTexto: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.primary },
  botonPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  botonPrimarioTexto: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.white },
  desktopGrid: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  desktopColumna: { flex: 1 },
  listaDesktop: {},

  // Card de categoría (compartida mobile/desktop)
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 12,
    marginHorizontal: 12,
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  sectionHeaderIcono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderEmoji: { fontSize: 18 },
  sectionHeaderTexto: { flex: 1, fontFamily: Fonts.bold, fontSize: 16, color: Colors.textPrimary },
  sectionHeaderBadge: {
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  sectionHeaderBadgeTexto: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.textSecondary },
  sectionItems: { paddingHorizontal: 8, paddingBottom: 8, gap: 2 },
  sectionItemsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 2 },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    gap: 10,
  },
  semaforoHalo: {
    width: 19,
    height: 19,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semaforoDot: { width: 11, height: 11, borderRadius: 999 },
  info: { flex: 1 },
  nombre: { fontFamily: Fonts.semibold, fontSize: 15.5, color: Colors.textPrimary },
  cantidadMeta: { fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.textSecondary, marginTop: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 999,
    padding: 3,
  },
  stepperBoton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBotonPressed: { backgroundColor: '#dfc6a8' },
  stepperCantidad: { fontFamily: Fonts.bold, fontSize: 14.5, color: Colors.textPrimary, minWidth: 26, textAlign: 'center' },

  // Rail derecho de escritorio
  rail: { width: 320, gap: 16 },
  railCardOscura: {
    backgroundColor: '#2a1e1a',
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  railTituloOscuro: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#cbb5a5',
    marginBottom: 4,
  },
  railVacio: { fontFamily: Fonts.medium, fontSize: 13, color: '#cbb5a5' },
  railFilaReponer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  railDot: { width: 7, height: 7, borderRadius: 999 },
  railFilaReponerTexto: { flex: 1, fontFamily: Fonts.semibold, fontSize: 14, color: Colors.white },
  railError: { color: Colors.error, fontFamily: Fonts.medium, fontSize: 12, marginTop: 4 },
  botonGenerarLista: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  botonDisabled: { opacity: 0.5 },
  botonGenerarListaTexto: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.white },
  railCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  railTitulo: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  railFilaAlerta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  railFilaAlertaTexto: { flex: 1, fontFamily: Fonts.semibold, fontSize: 14, color: Colors.textPrimary, marginRight: 8 },
  railFilaAlertaDelta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  railFilaAlertaDeltaTexto: { fontFamily: Fonts.bold, fontSize: 13.5 },
});
