#!/usr/bin/env node
//
// Sincroniza catalogo_sepa_ref con el dataset público SEPA/Precios Claros
// (datos.produccion.gob.ar). Corre como job de GitHub Actions
// (.github/workflows/sync-catalogo-sepa.yml), NO como Edge Function de
// Supabase: el ZIP nacional completo (18 comercios) pesa 300MB+
// comprimidos y un solo comercio grande (DIA) ya tiene 4M+ filas de
// producto — muy por encima de lo que una Edge Function (Deno, ~150s de
// límite de ejecución y memoria acotada) puede procesar. Un runner de
// GitHub Actions tiene tiempo/memoria de sobra para esto.
//
// Verificado contra una descarga real del dataset (no solo la
// especificación en PDF): separador "|" (pese al nombre ".csv"), BOM
// UTF-8, líneas \r\n, trailer "Ultima actualizacion: <ISO8601>". El
// escaping por comillas dobles que describe la spec para valores con "|"
// no se usa en la práctica (se vieron comillas sueltas sin envolver el
// valor) — un split('|') simple por línea alcanza.
//
// Requiere en el entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (la
// service_role key porque catalogo_sepa_ref solo la escribe ese rol, RLS
// no permite insert/update a authenticated/anon — nunca exponerla al
// cliente). Variables opcionales para pruebas manuales: SEPA_DIA
// (lunes..domingo, default: día actual en Argentina) y SEPA_COMERCIOS
// (lista separada por comas de id_comercio, default: los 5 elegidos
// abajo).

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

// id_comercio elegidos con el usuario (ver CLAUDE.md): cadenas grandes que
// cubren la mayoría de lo que la gente compra, sin procesar los 18
// comercios del dataset completo — decenas de millones de filas extra
// para muy poco beneficio adicional, dado que solo nos interesan
// productos únicos (EAN + nombre + marca), no precios por sucursal.
// 10 = Carrefour Market, 15 = Supermercados DIA, 11 = SuperChangomas
// (masonline), 2 = La Anónima, 8 = Mariano Max.
const COMERCIOS_ELEGIDOS = new Set(
  (process.env.SEPA_COMERCIOS ?? '10,15,11,2,8').split(',').map((s) => s.trim())
);

const DATASET_ID = '6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5';
// Recursos fijos por día de semana (se sobrescriben cada semana, no son
// archivos por fecha) — ids confirmados vía la API CKAN de datos.gob.ar.
const RECURSOS_POR_DIA = {
  domingo: 'f8e75128-515a-436e-bf8d-5c63a62f2005',
  lunes: '0a9069a9-06e8-4f98-874d-da5578693290',
  martes: '9dc06241-cc83-44f4-8e25-c9b1636b8bc8',
  miercoles: '1e92cd42-4f94-4071-a165-62c4cb2ce23c',
  jueves: 'd076720f-a7f0-4af8-b1d6-1b99d5a90c14',
  viernes: '91bc072a-4726-44a1-85ec-4a8467aad27e',
  sabado: 'b3c3da5d-213d-41e7-8d74-f23fda0a3c30',
};
const DIAS_POR_INDICE = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

function diaDeHoyEnArgentina() {
  // ART es UTC-3 todo el año (sin horario de verano) — alcanza con restar
  // 3 horas a UTC, no hace falta Intl.DateTimeFormat con timezone.
  const ahoraArt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return DIAS_POR_INDICE[ahoraArt.getUTCDay()];
}

async function descargarArchivo(url, ruta) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`Descarga falló: HTTP ${respuesta.status} en ${url}`);
  }
  await writeFile(ruta, Buffer.from(await respuesta.arrayBuffer()));
}

// Lee productos.csv de adentro de un ZIP de un comercio sin extraerlo a
// disco entero: unzip -p lo manda por stdout, se parsea línea por línea.
// Necesario porque el comercio más grande de los elegidos tiene ~4-6
// millones de filas — cargarlo entero en memoria como un solo string sería
// un desperdicio innecesario.
async function* lineasDeCsvEnZip(rutaZip, nombreArchivo) {
  const proceso = spawn('unzip', ['-p', rutaZip, nombreArchivo]);
  proceso.stdout.setEncoding('utf8');
  const rl = readline.createInterface({ input: proceso.stdout, crlfDelay: Infinity });

  for await (const linea of rl) {
    yield linea;
  }

  const codigoSalida = await new Promise((resolve, reject) => {
    proceso.on('error', reject);
    proceso.on('close', resolve);
  });
  if (codigoSalida !== 0) {
    throw new Error(`unzip -p ${nombreArchivo} salió con código ${codigoSalida}`);
  }
}

async function upsertLote(supabase, productos) {
  const { error } = await supabase
    .from('catalogo_sepa_ref')
    .upsert(productos, { onConflict: 'codigo_barras' });
  if (error) {
    throw new Error(`Upsert a catalogo_sepa_ref falló: ${error.message}`);
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  }
  // Este script solo hace upserts en batch, no usa Realtime — pasamos
  // `ws` igual porque el cliente lo inicializa siempre en el constructor,
  // y Node < 22 no trae WebSocket nativo (falla al crear el cliente si no
  // se provee un transport).
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    realtime: { transport: ws },
  });

  const dia = process.env.SEPA_DIA ?? diaDeHoyEnArgentina();
  const resourceId = RECURSOS_POR_DIA[dia];
  if (!resourceId) {
    throw new Error(`SEPA_DIA inválido: "${dia}" (esperado lunes..domingo)`);
  }

  const url = `https://datos.produccion.gob.ar/dataset/${DATASET_ID}/resource/${resourceId}/download/sepa_${dia}.zip`;
  const dirTemp = await mkdtemp(path.join(tmpdir(), 'sepa-'));
  const rutaZip = path.join(dirTemp, `sepa_${dia}.zip`);

  try {
    // SEPA_ZIP_LOCAL: opcional, para reprocesar un ZIP ya descargado sin
    // volver a bajar ~300MB (pruebas locales, o backfill de un día
    // puntual guardado a mano).
    if (process.env.SEPA_ZIP_LOCAL) {
      console.log(`Usando ZIP local: ${process.env.SEPA_ZIP_LOCAL}`);
      await execFileSync('cp', [process.env.SEPA_ZIP_LOCAL, rutaZip]);
    } else {
      console.log(`Descargando ${url}...`);
      await descargarArchivo(url, rutaZip);
      console.log('Descarga completa.');
    }

    const listado = execFileSync('unzip', ['-l', rutaZip], { encoding: 'utf8' });
    const entradas = listado
      .split('\n')
      .map((l) => l.trim().split(/\s+/).pop())
      .filter((nombre) => nombre?.endsWith('.zip'));

    const entradasElegidas = entradas.filter((nombre) => {
      const m = nombre.match(/comercio-sepa-(\d+)_/);
      return m && COMERCIOS_ELEGIDOS.has(m[1]);
    });

    console.log(
      `Comercios encontrados: ${entradasElegidas.length} de ${COMERCIOS_ELEGIDOS.size} elegidos (${[...COMERCIOS_ELEGIDOS].join(', ')}).`
    );
    if (entradasElegidas.length === 0) {
      throw new Error('Ningún comercio elegido apareció en el ZIP del día — revisar SEPA_COMERCIOS.');
    }

    const productosPorEan = new Map();

    for (const nombreEntrada of entradasElegidas) {
      const idComercio = nombreEntrada.match(/comercio-sepa-(\d+)_/)[1];
      console.log(`Procesando comercio ${idComercio}...`);

      execFileSync('unzip', ['-o', rutaZip, nombreEntrada, '-d', dirTemp], { stdio: 'ignore' });
      const rutaInner = path.join(dirTemp, nombreEntrada);

      let filas = 0;
      let esHeader = true;
      for await (const linea of lineasDeCsvEnZip(rutaInner, 'productos.csv')) {
        if (esHeader) {
          esHeader = false;
          continue;
        }

        const campos = linea.split('|');
        if (campos.length < 9) continue; // línea vacía o el trailer "Ultima actualizacion: ..."
        filas++;

        // Orden de campos de productos.csv (Anexo II SEPA):
        // id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|
        // productos_descripcion|...|productos_marca|...
        const idProducto = campos[3];
        const esEan = campos[4];
        const descripcion = campos[5];
        const marca = campos[8];

        if (esEan !== '1') continue; // código interno del comercio, no un EAN real

        const codigoBarras = idProducto.trim();
        const nombreSepa = descripcion.trim();
        if (!codigoBarras || !nombreSepa) continue;

        productosPorEan.set(codigoBarras, {
          codigo_barras: codigoBarras,
          nombre_sepa: nombreSepa,
          marca: marca?.trim() || null,
          // Sin mapeo de categoría: SEPA no usa nuestra taxonomía y una
          // heurística por palabras clave iba a errar seguido — mejor
          // dejarlo sin sugerencia que sugerir mal (mismo criterio que
          // el resto del proyecto). El usuario elige la categoría real
          // al crear el producto desde una sugerencia SEPA.
          categoria_sugerida_id: null,
          ultima_actualizacion: new Date().toISOString(),
        });
      }
      console.log(`  ${filas} filas leídas.`);
    }

    console.log(`Productos únicos con EAN a upsertear: ${productosPorEan.size}`);

    const productos = [...productosPorEan.values()];
    const TAMANO_LOTE = 500;
    for (let i = 0; i < productos.length; i += TAMANO_LOTE) {
      const lote = productos.slice(i, i + TAMANO_LOTE);
      await upsertLote(supabase, lote);
      console.log(`  Upserted ${Math.min(i + TAMANO_LOTE, productos.length)} / ${productos.length}`);
    }

    console.log('Listo.');
  } finally {
    rmSync(dirTemp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
