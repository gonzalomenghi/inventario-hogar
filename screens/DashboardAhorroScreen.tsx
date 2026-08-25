import { TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import GraficoGastoMensual from './GraficoGastoMensual';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useDashboardAhorro } from '../hooks/useDashboardAhorro';

const formatoMoneda = (valor: number) =>
  `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const anioActual = new Date(gastoMensual[0].mes).getUTCFullYear();

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Tu ahorro</Text>
        <Text style={styles.titulo}>Historial</Text>
      </View>

      <View style={styles.seccion}>
        <View style={styles.seccionHeaderFila}>
          <Text style={styles.seccionTitulo}>Gasto por mes</Text>
          <Text style={styles.anio}>{anioActual}</Text>
        </View>
        <GraficoGastoMensual gastoMensual={gastoMensual} />
      </View>

      {mejorSupermercado.length > 0 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Dónde conviene comprar</Text>
          {mejorSupermercado.map((m) => (
            <View key={m.producto_id} style={styles.filaDoble}>
              <View style={styles.filaDobleInfo}>
                <Text style={styles.filaTexto}>{m.producto_nombre}</Text>
                <Text style={styles.filaSubtexto}>{formatoMoneda(m.precio_promedio)} prom.</Text>
              </View>
              <View style={styles.badgeSuper}>
                <Text style={styles.badgeSuperTexto}>{m.supermercado_nombre}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tendencias.length > 0 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Tendencia de precios</Text>
          {tendencias.map((t) => {
            const delta = ((t.precio_actual - t.precio_anterior) / t.precio_anterior) * 100;
            const subio = delta > 0;

            return (
              <View key={t.producto_id} style={styles.filaTendencia}>
                <View style={[styles.iconoTendencia, { backgroundColor: subio ? Colors.errorTint : Colors.successTint }]}>
                  {subio ? (
                    <TrendingUp size={16} color={Colors.errorTintText} strokeWidth={2.75} />
                  ) : (
                    <TrendingDown size={16} color={Colors.successTintText} strokeWidth={2.75} />
                  )}
                </View>
                <View style={styles.filaDobleInfo}>
                  <Text style={styles.filaTexto}>{t.producto_nombre}</Text>
                  <Text style={styles.filaSubtexto}>{formatoMoneda(t.precio_actual)}</Text>
                </View>
                <Text style={[styles.deltaTexto, { color: subio ? Colors.error : Colors.success }]}>
                  {subio ? '+' : ''}
                  {delta.toFixed(0)}%
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
  errorText: { color: Colors.error, textAlign: 'center', fontFamily: Fonts.medium },
  mensajeVacio: { textAlign: 'center', color: Colors.textSecondary, fontFamily: Fonts.medium, fontSize: 15, lineHeight: 22 },
  contenido: { padding: 16, paddingBottom: 40, gap: 16 },
  header: { paddingHorizontal: 4, marginBottom: 4 },
  kicker: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.textSecondary },
  titulo: { fontFamily: Fonts.bold, fontSize: 21, color: Colors.textPrimary },
  seccion: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: '#2a1e1a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  seccionHeaderFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seccionTitulo: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  anio: { fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  filaDoble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  filaDobleInfo: { flex: 1, gap: 2 },
  filaTexto: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  filaSubtexto: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSecondary },
  badgeSuper: { backgroundColor: Colors.successTint, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  badgeSuperTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.successTintText },
  filaTendencia: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  iconoTendencia: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  deltaTexto: { fontSize: 13.5, fontFamily: Fonts.bold },
});
