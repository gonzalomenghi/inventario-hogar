import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
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
export default function DescuentoPicker({
  tipo,
  valor,
  onChangeTipo,
  onChangeValor,
}: {
  tipo: TipoDescuento;
  valor: string;
  onChangeTipo: (tipo: TipoDescuento) => void;
  onChangeValor: (valor: string) => void;
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
              style={[styles.chip, activo && styles.chipActivo]}
              onPress={() => {
                onChangeTipo(op.valor);
                if (op.presetValor !== undefined) onChangeValor(op.presetValor);
              }}
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
            onChangeText={onChangeValor}
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActivo: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTexto: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  chipTextoActivo: { color: Colors.white },
  hint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    width: 100,
  },
});
