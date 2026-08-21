import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { Database } from '../types/database.types';

// Definí estas variables en app.config.ts (extra.supabaseUrl / extra.supabaseAnonKey)
// o en un .env con expo-constants. NUNCA hardcodees la anon key en el repo público.
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // false en mobile; en build web lo podés poner true
  },
});
