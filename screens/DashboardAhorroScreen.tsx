import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
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
      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Gasto por mes</Text>
        {gastoMensual.map((g) => (
          <View key={g.mes} style={styles.filaMes}>
            <View>
              <Text style={styles.filaTexto}>{formatoMes(g.mes)}</Text>
              <Text style={styles.filaSubtexto}>
                {g.cantidad_compras} {g.cantidad_compras === 1 ? 'compra' : 'compras'}
              </Text>
            </View>
            <Text style={styles.filaMonto}>{formatoMoneda(g.gasto_total)}</Text>
          </View>
        ))}
      </View>

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
            const delta = ((t.precio_actual - t.precio_anterior) / t.precio_anterior) * 100;

            return (
              <View key={t.producto_id} style={styles.filaDoble}>
                <Text style={styles.filaTexto}>{t.producto_nombre}</Text>
                <Text
                  style={[
                    styles.filaSubtexto,
                    delta > 0 && styles.textoSubio,
                    delta < 0 && styles.textoBajo,
                  ]}
                >
                  {formatoMoneda(t.precio_actual)} · {delta > 0 ? '+' : ''}
                  {delta.toFixed(0)}% vs. anterior
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
  errorText: { color: Colors.error, textAlign: 'center' },
  mensajeVacio: { textAlign: 'center', color: Colors.textSecondary, fontSize: 15, lineHeight: 22 },
  contenido: { padding: 16, paddingBottom: 40, gap: 16 },
  seccion: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  seccionTitulo: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  filaDoble: { gap: 2 },
  filaTexto: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  filaSubtexto: { fontSize: 13, color: Colors.textSecondary },
  filaMes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  filaMonto: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  textoSubio: { color: Colors.error },
  textoBajo: { color: Colors.success },
});
