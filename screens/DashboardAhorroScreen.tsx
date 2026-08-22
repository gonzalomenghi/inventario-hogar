import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDashboardAhorro } from '../hooks/useDashboardAhorro';

const formatoMoneda = (valor: number) =>
  `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatoMes(mesIso: string) {
  const fecha = new Date(mesIso);
  return `${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
}

export default function DashboardAhorroScreen() {
  const { gastoMensual, mejorSupermercado, tendencias, loading, error } = useDashboardAhorro();

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
        <Text style={styles.errorText}>No se pudo cargar el historial: {error}</Text>
      </View>
    );
  }

  const mesActual = gastoMensual[0];
  const sinDatos = gastoMensual.length === 0;

  if (sinDatos) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mensajeVacio}>
          Todavía no hay precios cargados. Cuando marques ítems como comprados con precio en Modo
          Supermercado, acá vas a ver tu gasto y comparaciones.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <View style={styles.tarjeta}>
        <Text style={styles.tarjetaLabel}>Gasto de {formatoMes(mesActual.mes)}</Text>
        <Text style={styles.tarjetaValor}>{formatoMoneda(mesActual.gasto_total)}</Text>
        <Text style={styles.tarjetaSubtexto}>
          {mesActual.cantidad_compras} {mesActual.cantidad_compras === 1 ? 'compra' : 'compras'}
        </Text>
      </View>

      {gastoMensual.length > 1 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Meses anteriores</Text>
          {gastoMensual.slice(1).map((g) => (
            <View key={g.mes} style={styles.filaSimple}>
              <Text style={styles.filaTexto}>{formatoMes(g.mes)}</Text>
              <Text style={styles.filaTexto}>{formatoMoneda(g.gasto_total)}</Text>
            </View>
          ))}
        </View>
      )}

      {mejorSupermercado.length > 0 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Mejor supermercado por producto</Text>
          {mejorSupermercado.map((m) => (
            <View key={m.producto_id} style={styles.filaDoble}>
              <Text style={styles.filaTexto}>{m.producto_nombre}</Text>
              <Text style={styles.filaSubtexto}>
                {m.supermercado_nombre} · {formatoMoneda(m.precio_promedio)} prom.
              </Text>
            </View>
          ))}
        </View>
      )}

      {tendencias.length > 0 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Tendencia de precios</Text>
          {tendencias.map((t) => {
            const delta =
              t.precio_anterior != null
                ? ((t.precio_actual - t.precio_anterior) / t.precio_anterior) * 100
                : null;
            const subioColor = delta != null && delta > 0;
            const bajoColor = delta != null && delta < 0;

            return (
              <View key={t.producto_id} style={styles.filaDoble}>
                <Text style={styles.filaTexto}>{t.producto_nombre}</Text>
                <Text
                  style={[
                    styles.filaSubtexto,
                    subioColor && styles.textoSubio,
                    bajoColor && styles.textoBajo,
                  ]}
                >
                  {formatoMoneda(t.precio_actual)}
                  {delta != null && ` · ${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs. anterior`}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#E5484D', textAlign: 'center' },
  mensajeVacio: { textAlign: 'center', color: '#6B7280', fontSize: 15, lineHeight: 22 },
  // paddingTop extra: en web la tab bar flota encima del contenido
  // (position: absolute en app-tabs.web.tsx), así que el primer elemento
  // necesita despejarla — otras pantallas no lo notan porque centran su
  // contenido, pero acá arranca pegado arriba.
  contenido: { padding: 16, paddingTop: 76, paddingBottom: 40, gap: 16 },
  tarjeta: {
    backgroundColor: '#208AEF',
    borderRadius: 16,
    padding: 20,
  },
  tarjetaLabel: { color: '#DCEBFF', fontSize: 13, fontWeight: '600' },
  tarjetaValor: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
  tarjetaSubtexto: { color: '#DCEBFF', fontSize: 13, marginTop: 4 },
  seccion: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  seccionTitulo: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 4,
  },
  filaSimple: { flexDirection: 'row', justifyContent: 'space-between' },
  filaDoble: { gap: 2 },
  filaTexto: { fontSize: 15, fontWeight: '600', color: '#111827' },
  filaSubtexto: { fontSize: 13, color: '#6B7280' },
  textoSubio: { color: '#E5484D' },
  textoBajo: { color: '#30A46C' },
});
