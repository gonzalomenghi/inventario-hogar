import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/typography';
import { supabase } from '../lib/supabase';

// RN no tiene pseudo-clase :focus — se trackea a mano para el outline de
// foco (solo aplica en web, ver estiloFoco más abajo).
type CampoFoco = 'email' | 'password' | null;

export default function AuthScreen() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [campoFoco, setCampoFoco] = useState<CampoFoco>(null);

  const submit = async () => {
    setError(null);
    setMensaje(null);
    setLoading(true);

    const { error, data } =
      modo === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (modo === 'registro' && !data.session) {
      setMensaje('Cuenta creada. Revisá tu email para confirmarla antes de iniciar sesión.');
    }
  };

  const continuarConGoogle = async () => {
    setError(null);
    setMensaje(null);
    setLoadingGoogle(true);

    // signInWithOAuth navega el browser a Google — si no hay error acá, la
    // página se va a redirigir sola, no hace falta hacer nada más.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setError(error.message);
      setLoadingGoogle(false);
    }
  };

  const estiloFoco = (campo: CampoFoco) =>
    Platform.OS === 'web' && campoFoco === campo
      ? ({ outlineStyle: 'solid', outlineWidth: 2, outlineColor: Colors.primary } as const)
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.circuloArribaDerecha} />
      <View style={styles.circuloChico} />
      <View style={styles.circuloAbajoIzquierda} />

      <View style={styles.contenido}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.headline}>Tu alacena,{'\n'}siempre al día</Text>
        <Text style={styles.sub}>Inventario, listas y precios en un solo lugar</Text>

        <TextInput
          style={[styles.input, estiloFoco('email')]}
          placeholder="Email"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setCampoFoco('email')}
          onBlur={() => setCampoFoco(null)}
        />
        <TextInput
          style={[styles.input, estiloFoco('password')]}
          placeholder="Contraseña"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onFocus={() => setCampoFoco('password')}
          onBlur={() => setCampoFoco(null)}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}

        <PressableFeedback
          style={({ pressed }) => [
            styles.boton,
            pressed && styles.botonPressed,
            (loading || !email || !password) && styles.botonDisabled,
          ]}
          onPress={submit}
          disabled={loading || !email || !password}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.botonTexto}>
              {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </Text>
          )}
        </PressableFeedback>

        <PressableFeedback onPress={() => setModo(modo === 'login' ? 'registro' : 'login')}>
          <Text style={styles.link}>
            {modo === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
            <Text style={styles.linkAccion}>
              {modo === 'login' ? 'Creá una' : 'Iniciá sesión'}
            </Text>
          </Text>
        </PressableFeedback>

        {Platform.OS === 'web' && (
          <>
            <View style={styles.divisor}>
              <View style={styles.divisorLinea} />
              <Text style={styles.divisorTexto}>o</Text>
              <View style={styles.divisorLinea} />
            </View>

            <PressableFeedback
              style={[styles.botonGoogle, loadingGoogle && styles.botonDisabled]}
              onPress={continuarConGoogle}
              disabled={loadingGoogle}
            >
              {loadingGoogle ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.botonGoogleTexto}>Continuar con Google</Text>
              )}
            </PressableFeedback>
          </>
        )}
      </View>
    </View>
  );
}

const sombraCard = {
  shadowColor: '#2a1e1a',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

const sombraFab = {
  shadowColor: '#c1552c',
  shadowOpacity: 0.4,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, overflow: 'hidden' },
  circuloArribaDerecha: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.backgroundMuted,
  },
  circuloChico: {
    position: 'absolute',
    top: 70,
    right: 40,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryTint,
  },
  circuloAbajoIzquierda: {
    position: 'absolute',
    bottom: -70,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.backgroundMuted,
  },
  contenido: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  logo: { width: 76, height: 76, alignSelf: 'center', marginBottom: 20 },
  headline: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    textAlign: 'center',
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  sub: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 22,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    ...sombraCard,
  },
  error: { color: Colors.error, textAlign: 'center', fontFamily: Fonts.medium },
  mensaje: { color: Colors.success, textAlign: 'center', fontFamily: Fonts.medium },
  boton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    ...sombraFab,
  },
  botonPressed: { backgroundColor: Colors.primaryDark },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 15.5 },
  link: { textAlign: 'center', color: Colors.textSecondary, marginTop: 16, fontFamily: Fonts.medium },
  linkAccion: { color: Colors.primary, fontFamily: Fonts.bold },
  divisor: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10 },
  divisorLinea: { flex: 1, height: 1, backgroundColor: Colors.border },
  divisorTexto: { color: Colors.textSecondary, fontSize: 13, fontFamily: Fonts.medium },
  botonGoogle: {
    backgroundColor: Colors.white,
    borderRadius: 999,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
    ...sombraCard,
  },
  botonGoogleTexto: { color: Colors.textPrimary, fontFamily: Fonts.bold, fontSize: 14.5 },
});
