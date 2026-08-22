// Edge Function: procesar-ticket
//
// Recibe una foto de un ticket de supermercado (base64) y devuelve los
// ítems detectados como JSON estructurado, vía Claude (Anthropic),
// modelo de visión. NO escribe nada en la base — es una transformación
// pura imagen → JSON. El cliente revisa/edita el resultado y recién ahí
// hace el matching (buscar_producto_similar) y el insert en
// precios_historico (fuente = 'ocr_ticket'), igual que hace a mano hoy.
//
// Requiere el secret ANTHROPIC_API_KEY (`supabase secrets set
// ANTHROPIC_API_KEY=...`). SUPABASE_URL / SUPABASE_ANON_KEY los inyecta
// la plataforma automáticamente en toda Edge Function, no hace falta
// configurarlos.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MODEL = 'claude-opus-5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TICKET_SCHEMA = {
  type: 'object',
  properties: {
    supermercado_sugerido: { type: ['string', 'null'] },
    fecha_sugerida: {
      type: ['string', 'null'],
      description: 'Formato AAAA-MM-DD si es legible en el ticket, si no null.',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          cantidad: { type: 'number' },
          precio_unitario: { type: 'number' },
          precio_final: { type: 'number' },
        },
        required: ['nombre', 'cantidad', 'precio_unitario', 'precio_final'],
        additionalProperties: false,
      },
    },
  },
  required: ['supermercado_sugerido', 'fecha_sugerida', 'items'],
  additionalProperties: false,
};

const PROMPT = `Este archivo (foto o PDF) es un ticket de compra de un supermercado
argentino. Extraé cada ítem comprado: nombre del producto tal como
aparece impreso (no lo "traduzcas" ni corrijas de más, pero sí expandí
abreviaturas obvias como "LA SEREN" -> "La Serenísima" si es claro),
cantidad comprada, precio unitario y precio final de esa línea
(después de cualquier descuento que ya esté aplicado). Si el PDF tiene
varias páginas, es probablemente el mismo ticket paginado — combiná
los ítems de todas las páginas en una sola lista.
Si un dato no es legible o no está, usá null. No inventes ítems que no
estén en el ticket. Si el nombre del supermercado o la fecha de compra
son legibles en el encabezado, incluilos.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Requiere un usuario autenticado real (no solo la anon key) — esta
  // función factura por llamada, no queremos que cualquiera con la
  // anon key pública la use gratis.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { imagenBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido, se esperaba JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { imagenBase64, mediaType } = body;
  if (!imagenBase64) {
    return new Response(JSON.stringify({ error: 'Falta imagenBase64' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // PDF usa un content block distinto ("document") al de fotos ("image")
  // en la Messages API — no es solo cambiar el media_type.
  const esPdf = mediaType === 'application/pdf';
  const bloqueArchivo = esPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: imagenBase64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mediaType ?? 'image/jpeg', data: imagenBase64 },
      };

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [bloqueArchivo, { type: 'text', text: PROMPT }],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: TICKET_SCHEMA } },
    }),
  });

  if (!anthropicRes.ok) {
    const detalle = await anthropicRes.text();
    return new Response(
      JSON.stringify({ error: `Error de Claude (${anthropicRes.status}): ${detalle}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const data = await anthropicRes.json();
  const bloqueTexto = data.content?.find((b: { type: string }) => b.type === 'text');

  if (!bloqueTexto) {
    return new Response(JSON.stringify({ error: 'Claude no devolvió texto' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let ticket: unknown;
  try {
    ticket = JSON.parse(bloqueTexto.text);
  } catch {
    return new Response(JSON.stringify({ error: 'La respuesta de Claude no era JSON válido' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(ticket), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
