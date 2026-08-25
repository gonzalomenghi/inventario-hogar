import { Pencil, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { useCategorias } from '../hooks/useCategorias';
import type { Categoria } from '../types/database.types';

// Selector de categoría con alta/edición inline (chip "+" para crear,
// lápiz para editar nombre/ícono) — se usa tanto al crear un producto
// (AgregarProductoModal) como al editar uno existente (DetalleProductoModal).
// Se maneja solo (llama a useCategorias() internamente): ambos call sites
// lo usan como <CategoriaPicker value={...} onChange={...} /> sin
// levantar estado de categorías.
export default function CategoriaPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (categoriaId: string) => void;
}) {
  const { categorias, loading, error, crearCategoria, editarCategoria } = useCategorias();

  // null = formulario cerrado; 'nueva' = alta; id = edición de esa categoría
  const [formAbierto, setFormAbierto] = useState<'nueva' | string | null>(null);
  const [nombreForm, setNombreForm] = useState('');
  const [iconoForm, setIconoForm] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirAlta = () => {
    setFormAbierto('nueva');
    setNombreForm('');
    setIconoForm('');
    setErrorForm(null);
  };

  const abrirEdicion = (cat: Categoria) => {
    setFormAbierto(cat.id);
    setNombreForm(cat.nombre);
    setIconoForm(cat.icono);
    setErrorForm(null);
  };

  const cancelarForm = () => {
    setFormAbierto(null);
    setErrorForm(null);
  };

  const guardarForm = async () => {
    // Guard contra doble submit: dos clicks casi simultáneos (doble tap,
    // o el evento de click/pointerup de RN Web disparando dos veces)
    // pueden ejecutar esto dos veces antes de que el prop `disabled` del
    // botón llegue a re-renderizar.
    if (guardando) return;

    if (!nombreForm.trim() || !iconoForm.trim()) {
      setErrorForm('Completá nombre e ícono.');
      return;
    }

    setGuardando(true);
    setErrorForm(null);

    if (formAbierto === 'nueva') {
      const creada = await crearCategoria(nombreForm, iconoForm);
      setGuardando(false);
      if (!creada) {
        setErrorForm('No se pudo guardar la categoría.');
        return;
      }
      onChange(creada.id);
      setFormAbierto(null);
      return;
    }

    if (formAbierto) {
      const ok = await editarCategoria(formAbierto, nombreForm, iconoForm);
      setGuardando(false);
      if (!ok) {
        setErrorForm('No se pudo guardar la categoría.');
        return;
      }
      setFormAbierto(null);
    }
  };

  return (
    <View>
      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <View style={styles.chips}>
          {categorias.map((cat) => (
            <View key={cat.id} style={styles.chipConLapiz}>
              <PressableFeedback
                style={({ pressed }) => [
                  styles.chip,
                  value === cat.id && styles.chipActivo,
                  pressed && value === cat.id && styles.chipPressed,
                ]}
                onPress={() => onChange(cat.id)}
                onLongPress={() => abrirEdicion(cat)}
              >
                <Text style={[styles.chipTexto, value === cat.id && styles.chipTextoActivo]}>
                  {cat.icono} {cat.nombre}
                </Text>
              </PressableFeedback>
              <PressableFeedback
                style={styles.lapiz}
                onPress={() => abrirEdicion(cat)}
                accessibilityLabel={`Editar categoría ${cat.nombre}`}
              >
                <Pencil size={12} color={Colors.textSecondary} strokeWidth={2.75} />
              </PressableFeedback>
            </View>
          ))}

          <PressableFeedback style={styles.chipNueva} onPress={abrirAlta}>
            <Plus size={16} color={Colors.primary} strokeWidth={2.75} />
          </PressableFeedback>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {formAbierto && (
        <View style={styles.form}>
          <Text style={styles.formTitulo}>
            {formAbierto === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
          </Text>
          <View style={styles.formFila}>
            <TextInput
              style={[styles.input, styles.inputIcono]}
              value={iconoForm}
              onChangeText={setIconoForm}
              placeholder="🍎"
            />
            <TextInput
              style={[styles.input, styles.inputNombre]}
              value={nombreForm}
              onChangeText={setNombreForm}
              placeholder="Nombre"
            />
          </View>

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
  chipConLapiz: { flexDirection: 'row', alignItems: 'center' },
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
  lapiz: { paddingHorizontal: 4, paddingVertical: 4, marginLeft: -8 },
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
  formFila: { flexDirection: 'row', gap: 8 },
  input: {
    borderRadius: 999,
    padding: 10,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputIcono: { width: 56, textAlign: 'center' },
  inputNombre: { flex: 1, paddingHorizontal: 16 },
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
