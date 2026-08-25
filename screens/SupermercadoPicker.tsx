import { Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useSupermercados } from '../hooks/useSupermercados';

// Selector de supermercado con alta inline (chip "+" para crear uno
// nuevo) — se maneja solo (llama a useSupermercados() internamente).
// Sin ícono ni edición (a diferencia de CategoriaPicker): no hay pedido
// de renombrar supermercados, se mantiene simple.
export default function SupermercadoPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (supermercadoId: string) => void;
}) {
  const { supermercados, loading, error, crearSupermercado } = useSupermercados();

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombreForm, setNombreForm] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirAlta = () => {
    setFormAbierto(true);
    setNombreForm('');
    setErrorForm(null);
  };

  const cancelarForm = () => {
    setFormAbierto(false);
    setErrorForm(null);
  };

  const guardarForm = async () => {
    if (guardando) return;

    if (!nombreForm.trim()) {
      setErrorForm('Completá el nombre.');
      return;
    }

    setGuardando(true);
    setErrorForm(null);

    const creado = await crearSupermercado(nombreForm);
    setGuardando(false);

    if (!creado) {
      setErrorForm('No se pudo guardar el supermercado.');
      return;
    }
    onChange(creado.id);
    setFormAbierto(false);
  };

  return (
    <View>
      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <View style={styles.chips}>
          {supermercados.map((s) => (
            <PressableFeedback
              key={s.id}
              style={({ pressed }) => [
                styles.chip,
                value === s.id && styles.chipActivo,
                pressed && value === s.id && styles.chipPressed,
              ]}
              onPress={() => onChange(s.id)}
            >
              <Text style={[styles.chipTexto, value === s.id && styles.chipTextoActivo]}>
                {s.nombre}
              </Text>
            </PressableFeedback>
          ))}

          <PressableFeedback style={styles.chipNueva} onPress={abrirAlta}>
            <Plus size={16} color={Colors.primary} strokeWidth={2.75} />
          </PressableFeedback>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {formAbierto && (
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Nuevo supermercado</Text>
          <TextInput
            style={styles.input}
            value={nombreForm}
            onChangeText={setNombreForm}
            placeholder="Coto, Dia, Carrefour..."
            autoFocus
          />

          {errorForm && <Text style={styles.error}>{errorForm}</Text>}

          <View style={styles.formBotones}>
            <PressableFeedback style={styles.botonCancelar} onPress={cancelarForm} disabled={guardando}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </PressableFeedback>
            <PressableFeedback
              style={[styles.botonGuardar, guardando && styles.botonDisabled]}
              onPress={guardarForm}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.botonGuardarTexto}>Guardar</Text>
              )}
            </PressableFeedback>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  spinner: { marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
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
  chipNueva: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: Colors.error, fontSize: 13, marginTop: 4, fontFamily: Fonts.medium },
  form: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.backgroundMuted,
    gap: 8,
  },
  formTitulo: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textSecondary },
  input: {
    borderRadius: 999,
    padding: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  formBotones: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  botonCancelar: { paddingVertical: 10, paddingHorizontal: 14 },
  botonCancelarTexto: { color: Colors.textSecondary, fontFamily: Fonts.semibold },
  botonGuardar: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonDisabled: { opacity: 0.5 },
  botonGuardarTexto: { color: Colors.white, fontFamily: Fonts.bold },
});
