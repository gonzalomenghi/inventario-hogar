// Tipos simplificados a mano, reflejando el schema de Fase 1.
// Cuando tengas la Supabase CLI, reemplazá este archivo generándolo con:
//   supabase gen types typescript --project-id TU_PROJECT_ID > types/database.types.ts

export type CategoriaProducto = 'alimentos' | 'higiene' | 'limpieza';
export type EstadoStock = 'rojo' | 'amarillo' | 'verde';
export type EstadoLista = 'activa' | 'completada' | 'cancelada';
export type TipoDescuento =
  | 'ninguno'
  | '2x1'
  | 'descuento_2da_unidad'
  | 'porcentaje'
  | 'monto_fijo';

export interface ProductoBase {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  unidad_medida: string;
  codigo_barras: string | null;
  imagen_url: string | null;
  marca: string | null;
}

export interface InventarioItem {
  id: string;
  user_id: string;
  producto_id: string;
  cantidad_actual: number;
  stock_minimo: number;
  unidad_medida: string;
  fecha_vencimiento: string | null;
  estado_stock: EstadoStock;
  updated_at: string;
  // Join con productos_base (via select con !inner o foreign table)
  producto?: ProductoBase;
}

export interface ListaCompra {
  id: string;
  user_id: string;
  nombre: string;
  estado: EstadoLista;
  supermercado_id: string | null;
  created_at: string;
}

export interface DetalleListaItem {
  id: string;
  lista_id: string;
  producto_id: string;
  cantidad_solicitada: number;
  comprado: boolean;
  cantidad_comprada: number | null;
  precio_unitario: number | null;
  tipo_descuento: TipoDescuento;
  valor_descuento: number | null;
  precio_final: number | null;
  supermercado_id: string | null;
  producto?: ProductoBase;
}

// Placeholder para que createClient<Database> tipe bien.
// Podés ampliarlo con Tables/Views/Functions cuando generes el tipo real.
export interface Database {
  public: {
    Tables: Record<string, any>;
    Views: Record<string, any>;
    Functions: Record<string, any>;
  };
}
