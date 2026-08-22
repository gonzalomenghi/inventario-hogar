import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ItemTicket {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_final: number;
}

export interface TicketProcesado {
  supermercado_sugerido: string | null;
  fecha_sugerida: string | null;
  items: ItemTicket[];
}

export function useEscanearTicket() {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procesarTicket = async (
    imagenBase64: string,
    mediaType: string
  ): Promise<TicketProcesado | null> => {
    setProcesando(true);
    setError(null);

    const { data, error: errorFuncion } = await supabase.functions.invoke('procesar-ticket', {
      body: { imagenBase64, mediaType },
    });

    setProcesando(false);

    if (errorFuncion) {
      setError(errorFuncion.message);
      return null;
    }

    if (data?.error) {
      setError(data.error);
      return null;
    }

    return data as TicketProcesado;
  };

  return { procesarTicket, procesando, error };
}
