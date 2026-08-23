import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import ModoSupermercadoScreen from '../../screens/ModoSupermercadoScreen';
import PressableFeedback from '../../screens/PressableFeedback';
import SupermercadoPicker from '../../screens/SupermercadoPicker';

export default function ModoSupermercadoTab() {
  const { session } = useAuth();
  const [listaId, setListaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creandoManual, setCreandoManual] = useState(false);
  const [supermercadoManual, setSupermercadoManual] = useState<string | null>(null);

  const buscarListaActiva = useCallback(async () => {
    const { data } = await supabase
      .from('listas_compra')
      .select('id')
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setListaId((data as { id: string } | null)?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    buscarListaActiva();
  }, [buscarListaActiva]);

  // fn_generar_lista_compra (backend): crea la lista con lo que ya está
  // en rojo/amarillo, o devuelve la activa existente si ya hay una. La
  // misma función corre sola todos los días vía pg_cron (Fase 3); esto
  // es para generarla/refrescarla al toque, sin esperar al schedule.
  const crearListaConStockBajo = async () => {
    setError(null);
    setCreando(true);

    const { data: listaIdNueva, error: errorRpc } = await supabase.rpc(
      'fn_generar_lista_compra'
    );

    setCreando(false);

    if (errorRpc || !listaIdNueva) {
      setError(errorRpc?.message ?? 'No se pudo crear la lista.');
      return;
    }

    setListaId(listaIdNueva);
  };

  // Lista manual: arranca vacía con el supermercado elegido; se llena
  // después desde el "+" de ModoSupermercadoScreen (AgregarItemListaModal).
  // A diferencia del RPC, acá el insert es directo desde el cliente, así
  // que hace falta el user_id explícito (el RPC lo resuelve solo via
  // auth.uid() del lado del server).
  const crearListaManual = async () => {
    if (!session || !supermercadoManual) return;
    setError(null);
    setCreando(true);

    const { data, error: errorInsert } = await supabase
      .from('listas_compra')
      .insert({ user_id: session.user.id, supermercado_id: supermercadoManual })
      .select('id')
      .single();

    setCreando(false);

    if (errorInsert || !data) {
      setError(errorInsert?.message ?? 'No se pudo crear la lista.');
      return;
    }

    // Reset acá (no solo en el reset-on-close de un modal, porque esta
    // pantalla nunca se desmonta): si no, al cancelar/eliminar la lista y
    // volver a este estado vacío, el formulario de "Crear lista manual"
    // queda expandido de la vez anterior en vez de mostrar el botón.
    setCreandoManual(false);
    setSupermercadoManual(null);
    setListaId(data.id);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!listaId) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.mensaje}>No hay una lista de compras activa todavía.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <PressableFeedback
            style={[styles.boton, creando && styles.botonDisabled]}
            onPress={crearListaConStockBajo}
            disabled={creando}
          >
            {creando ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.botonTexto}>Crear lista de compras</Text>
            )}
          </PressableFeedback>

          {!creandoManual ? (
            <PressableFeedback style={styles.botonSecundario} onPress={() => setCreandoManual(true)}>
              <Text style={styles.botonSecundarioTexto}>Crear lista manual</Text>
            </PressableFeedback>
          ) : (
            <View style={styles.formManual}>
              <Text style={styles.label}>Elegí el supermercado</Text>
              <SupermercadoPicker value={supermercadoManual} onChange={setSupermercadoManual} />

              <PressableFeedback
                style={[
                  styles.boton,
                  (creando || !supermercadoManual) && styles.botonDisabled,
                ]}
                onPress={crearListaManual}
                disabled={creando || !supermercadoManual}
              >
                {creando ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.botonTexto}>Crear lista</Text>
                )}
              </PressableFeedback>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ModoSupermercadoScreen listaId={listaId} onSalir={() => setListaId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  mensaje: { textAlign: 'center', color: Colors.textSecondary, fontSize: 15 },
  error: { color: Colors.error, textAlign: 'center' },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  botonSecundario: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  botonSecundarioTexto: { color: Colors.textPrimary, fontWeight: '600', fontSize: 16 },
  formManual: { width: '100%', maxWidth: 360, gap: 8 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
});
