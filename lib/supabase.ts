import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '../types/database.types';

// Definidas en .env (ver .env.example). Expo las inlinea automáticamente
// por el prefijo EXPO_PUBLIC_. La anon key es segura de exponer: el acceso
// real está protegido por las políticas RLS del schema.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copiá .env.example a .env y completá los valores.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // true en web: necesario para que el cliente detecte el token que Supabase
    // agrega en la URL al volver del redirect de OAuth (login con Google). En
    // mobile no hay URL de browser que parsear, se deja en false.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
