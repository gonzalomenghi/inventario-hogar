import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../constants/colors';
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
            <Pressable
              key={s.id}
              style={[styles.chip, value === s.id && styles.chipActivo]}
              onPress={() => onChange(s.id)}
            >
              <Text style={[styles.chipTexto, value === s.id && styles.chipTextoActivo]}>
                {s.nombre}
              </Text>
            </Pressable>
          ))}

          <Pressable style={styles.chipNueva} onPress={abrirAlta}>
            <Text style={styles.chipNuevaTexto}>+</Text>
          </Pressable>
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
            <Pressable style={styles.botonCancelar} onPress={cancelarForm} disabled={guardando}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.botonGuardar, guardando && styles.botonDisabled]}
              onPress={guardarForm}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.botonGuardarTexto}>Guardar</Text>
              )}
            </Pressable>
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActivo: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTexto: { color: Colors.textPrimary, fontWeight: '600' },
  chipTextoActivo: { color: Colors.white },
  chipNueva: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipNuevaTexto: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  error: { color: Colors.error, fontSize: 13, marginTop: 4 },
  form: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.backgroundMuted,
    gap: 8,
  },
  formTitulo: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: Colors.white,
  },
  formBotones: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  botonCancelar: { paddingVertical: 10, paddingHorizontal: 14 },
  botonCancelarTexto: { color: Colors.textSecondary, fontWeight: '600' },
  botonGuardar: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonDisabled: { opacity: 0.5 },
  botonGuardarTexto: { color: Colors.white, fontWeight: '700' },
});
