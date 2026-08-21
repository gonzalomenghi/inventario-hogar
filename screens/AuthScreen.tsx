import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

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

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Inventario Hogar</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}

      <Pressable
        style={[styles.boton, (loading || !email || !password) && styles.botonDisabled]}
        onPress={submit}
        disabled={loading || !email || !password}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>
            {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setModo(modo === 'login' ? 'registro' : 'login')}>
        <Text style={styles.link}>
          {modo === 'login' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Iniciá sesión'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  titulo: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: { color: '#E5484D', textAlign: 'center' },
  mensaje: { color: '#30A46C', textAlign: 'center' },
  boton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDisabled: { opacity: 0.5 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#208AEF', marginTop: 16 },
});
