import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import type { GastoMensual } from '../types/database.types';

// Compartido entre DashboardAhorroScreen (Historial) y el rail de
// escritorio de InventarioScreen — mismo contenido visual en las dos
// (monto del mes + delta + barras), evita duplicar la fórmula del gráfico.
// Solo Views (con expo-linear-gradient para la barra del mes actual), sin
// librería de charts.

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const ALTURA_MAX_BARRA = 64;

function formatoMoneda(valor: number) {
  return `$${valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function mesCorto(mesIso: string) {
  return MESES_CORTOS[new Date(mesIso).getUTCMonth()];
}

export default function GraficoGastoMensual({ gastoMensual }: { gastoMensual: GastoMensual[] }) {
  if (gastoMensual.length === 0) return null;

  // El hook devuelve gastoMensual ordenado descendente (más reciente
  // primero) — acá se necesita ascendente para dibujar de izquierda a
  // derecha con el mes actual al final.
  const ultimos = gastoMensual.slice(0, 4).reverse();
  const actual = ultimos[ultimos.length - 1];
  const anterior = ultimos.length > 1 ? ultimos[ultimos.length - 2] : null;
  const max = Math.max(...ultimos.map((g) => g.gasto_total), 1);
  const delta = anterior ? ((actual.gasto_total - anterior.gasto_total) / anterior.gasto_total) * 100 : null;

  return (
    <View>
      <Text style={styles.monto}>{formatoMoneda(actual.gasto_total)}</Text>
      {delta !== null && anterior && (
        <Text style={[styles.delta, delta > 0 ? styles.deltaSubio : styles.deltaBajo]}>
          {delta > 0 ? '+' : ''}
          {delta.toFixed(0)}% vs. {mesCorto(anterior.mes)}
        </Text>
      )}

      <View style={styles.barras}>
        {ultimos.map((g, i) => {
          const esActual = i === ultimos.length - 1;
          const altura = Math.max((g.gasto_total / max) * ALTURA_MAX_BARRA, 6);

          return (
            <View key={g.mes} style={styles.columna}>
              {esActual ? (
                <LinearGradient
                  colors={['#e0784a', '#c1552c']}
                  style={[styles.barra, { height: altura }]}
                />
              ) : (
                <View style={[styles.barra, styles.barraPasada, { height: altura }]} />
              )}
              <Text style={[styles.mesLabel, esActual && styles.mesLabelActivo]}>
                {mesCorto(g.mes)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monto: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.textPrimary },
  delta: { fontFamily: Fonts.semibold, fontSize: 13, marginTop: 2 },
  deltaSubio: { color: Colors.error },
  deltaBajo: { color: Colors.success },
  barras: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 16,
    height: ALTURA_MAX_BARRA,
  },
  columna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barra: { width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barraPasada: { backgroundColor: Colors.border },
  mesLabel: { fontFamily: Fonts.bold, fontSize: 11.5, color: Colors.textSecondary, marginTop: 6 },
  mesLabelActivo: { color: Colors.primary },
});
