import { Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useSupermercados } from '../hooks/useSupermercados';

// Cadenas reales del directorio de comercios de SEPA/Precios Claros (el
// mismo dataset que sincroniza catalogo_sepa_ref, ver
// scripts/sync-catalogo-sepa.mjs) — filtrado a cadenas de supermercado
// genuinas, sin estaciones de servicio/fabricantes que también aparecen
// en el dataset completo. Mientras menos tipeo manual, mejor: se muestran
// como chips de un toque en vez de que el usuario tenga que escribir cada
// supermercado desde cero.
const SUPERMERCADOS_SEPA = [
  'Coto',
  'Carrefour',
  'Dia',
  'Vea',
  'La Anónima',
  'Changomas',
  'Libertad',
  'Cooperativa Obrera',
  'California',
  'Comodín',
  'Mariano Max',
  'Unicoop',
];

// Selector de supermercado con alta inline ("+ Otro" para cargar uno que
// no esté en la lista sugerida) — se maneja solo (llama a
// useSupermercados() internamente). Sin ícono ni edición (a diferencia de
// CategoriaPicker): no hay pedido de renombrar supermercados.
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
  // Nombre del chip sugerido que se está creando (para mostrar el spinner
  // solo en ese chip, no un estado global) — null cuando ninguno está en curso.
  const [creandoSugerido, setCreandoSugerido] = useState<string | null>(null);

  const nombresYaCreados = new Set(supermercados.map((s) => s.nombre.trim().toLowerCase()));
  const sugeridos = SUPERMERCADOS_SEPA.filter((nombre) => !nombresYaCreados.has(nombre.toLowerCase()));

  const abrirAlta = () => {
    setFormAbierto(true);
    setNombreForm('');
    setErrorForm(null);
  };

  const cancelarForm = () => {
    setFormAbierto(false);
    setErrorForm(null);
  };

  const elegirSugerido = async (nombre: string) => {
    if (creandoSugerido) return;
    setCreandoSugerido(nombre);
    const creado = await crearSupermercado(nombre);
    setCreandoSugerido(null);

    if (creado) onChange(creado.id);
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

          {sugeridos.map((nombre) => (
            <PressableFeedback
              key={nombre}
              style={styles.chipSugerido}
              onPress={() => elegirSugerido(nombre)}
              disabled={creandoSugerido !== null}
            >
              {creandoSugerido === nombre ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : (
                <Text style={styles.chipSugeridoTexto}>{nombre}</Text>
              )}
            </PressableFeedback>
          ))}

          <PressableFeedback style={styles.chipNueva} onPress={abrirAlta} accessibilityLabel="Otro supermercado">
            <Plus size={16} color={Colors.primary} strokeWidth={2.75} />
          </PressableFeedback>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {formAbierto && (
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Otro supermercado</Text>
          <TextInput
            style={styles.input}
            value={nombreForm}
            onChangeText={setNombreForm}
            placeholder="Nombre del supermercado"
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
  // Sugeridos: mismo tamaño que un chip normal pero con borde punteado en
  // vez de fondo sólido, para distinguir "todavía no es tuyo, tocá para
  // agregarlo" de los que ya creaste.
  chipSugerido: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSugeridoTexto: { color: Colors.textSecondary, fontFamily: Fonts.semibold, fontSize: 13 },
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
