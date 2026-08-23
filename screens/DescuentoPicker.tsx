import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import type { TipoDescuento } from '../types/database.types';

const OPCIONES: { valor: TipoDescuento; label: string }[] = [
  { valor: 'ninguno', label: 'Sin descuento' },
  { valor: '2x1', label: '2x1' },
  { valor: 'descuento_2da_unidad', label: '2da unidad ½' },
  { valor: 'porcentaje', label: '% descuento' },
  { valor: 'monto_fijo', label: 'Monto fijo' },
];

// tipo_descuento fijo (los 5 valores del enum, sin alta/edición — a
// diferencia de CategoriaPicker/SupermercadoPicker). El campo de valor
// solo tiene sentido para porcentaje/monto_fijo/descuento_2da_unidad —
// 'ninguno' y '2x1' no lo usan en la fórmula de fn_comprar_item_lista.
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
  const mostrarValor = tipo === 'porcentaje' || tipo === 'monto_fijo' || tipo === 'descuento_2da_unidad';
  const placeholderValor = tipo === 'porcentaje' ? '%' : '$';

  return (
    <View>
      <View style={styles.chips}>
        {OPCIONES.map((op) => (
          <PressableFeedback
            key={op.valor}
            style={[styles.chip, tipo === op.valor && styles.chipActivo]}
            onPress={() => onChangeTipo(op.valor)}
          >
            <Text style={[styles.chipTexto, tipo === op.valor && styles.chipTextoActivo]}>
              {op.label}
            </Text>
          </PressableFeedback>
        ))}
      </View>

      {mostrarValor && (
        <TextInput
          style={styles.input}
          value={valor}
          onChangeText={onChangeValor}
          keyboardType="decimal-pad"
          placeholder={placeholderValor}
        />
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
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    width: 100,
  },
});
