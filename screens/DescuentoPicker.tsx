import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import type { TipoDescuento } from '../types/database.types';

// '3x2'/'4x3' no son valores de enum propios: son presets del tipo 'nxm'
// ("llevá N, pagá N-1"), que además cubre cualquier variante que no esté
// en la lista (5x4, 6x5...) — el usuario solo tiene que escribir la N en
// el campo de valor, no hace falta un tipo de descuento nuevo por cada
// combinación de supermercado.
const OPCIONES: { valor: TipoDescuento; label: string; presetValor?: string }[] = [
  { valor: 'ninguno', label: 'Sin descuento' },
  { valor: '2x1', label: '2x1' },
  { valor: 'nxm', label: '3x2', presetValor: '3' },
  { valor: 'nxm', label: '4x3', presetValor: '4' },
  { valor: 'descuento_2da_unidad', label: '% en la 2da unidad' },
  { valor: 'porcentaje', label: '% descuento' },
  { valor: 'monto_fijo', label: 'Cupón $' },
];

// tipo_descuento fijo (los valores del enum, sin alta/edición — a diferencia
// de CategoriaPicker/SupermercadoPicker). El campo de valor solo tiene
// sentido para porcentaje/monto_fijo/descuento_2da_unidad/nxm — 'ninguno' y
// '2x1' no lo usan en la fórmula de fn_calcular_precio_final.
//
// onChange es un único callback con (tipo, valor) — a propósito, no dos
// callbacks separados. Un preset como "3x2" necesita cambiar tipo Y valor
// a la vez ('nxm' + '3'); con dos callbacks (onChangeTipo, onChangeValor)
// disparados en el mismo tap, el segundo se computaba sobre el prop
// `tipo`/`valor` todavía viejo (React no re-renderiza entre uno y otro),
// así que pisaba el cambio del primero — bug real: los chips "3x2"/"4x3"
// nunca quedaban activos en callers que arman un solo objeto combinado a
// partir del prop actual (ModoSupermercadoScreen). Con un solo callback
// no hay ventana para que un cambio pise al otro.
export default function DescuentoPicker({
  tipo,
  valor,
  onChange,
}: {
  tipo: TipoDescuento;
  valor: string;
  onChange: (tipo: TipoDescuento, valor: string) => void;
}) {
  const mostrarValor =
    tipo === 'porcentaje' || tipo === 'monto_fijo' || tipo === 'descuento_2da_unidad' || tipo === 'nxm';
  const placeholderValor =
    tipo === 'porcentaje' || tipo === 'descuento_2da_unidad' ? '%' : tipo === 'nxm' ? 'N' : '$';

  return (
    <View>
      <View style={styles.chips}>
        {OPCIONES.map((op) => {
          const activo = tipo === op.valor && (op.presetValor === undefined || valor === op.presetValor);
          return (
            <PressableFeedback
              key={op.label}
              style={({ pressed }) => [
                styles.chip,
                activo && styles.chipActivo,
                pressed && activo && styles.chipPressed,
              ]}
              onPress={() => onChange(op.valor, op.presetValor ?? valor)}
            >
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{op.label}</Text>
            </PressableFeedback>
          );
        })}
      </View>

      {mostrarValor && (
        <>
          {tipo === 'nxm' && (
            <Text style={styles.hint}>¿Cuántos lleva la promo? Pagás uno menos.</Text>
          )}
          <TextInput
            style={styles.input}
            value={valor}
            onChangeText={(v) => onChange(tipo, v)}
            keyboardType="decimal-pad"
            placeholder={placeholderValor}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActivo: { backgroundColor: Colors.primary },
  chipPressed: { backgroundColor: Colors.primaryDark },
  chipTexto: { color: Colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 13 },
  chipTextoActivo: { color: Colors.white, fontFamily: Fonts.bold },
  hint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6, fontFamily: Fonts.medium },
  input: {
    borderRadius: 999,
    padding: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    width: 100,
  },
});
