export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      catalogo_sepa_ref: {
        Row: {
          categoria_sugerida_id: string | null
          codigo_barras: string
          marca: string | null
          nombre_sepa: string
          ultima_actualizacion: string
        }
        Insert: {
          categoria_sugerida_id?: string | null
          codigo_barras: string
          marca?: string | null
          nombre_sepa: string
          ultima_actualizacion?: string
        }
        Update: {
          categoria_sugerida_id?: string | null
          codigo_barras?: string
          marca?: string | null
          nombre_sepa?: string
          ultima_actualizacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_sepa_ref_categoria_sugerida_id_fkey"
            columns: ["categoria_sugerida_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          icono: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icono: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icono?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      detalle_lista: {
        Row: {
          cantidad_comprada: number | null
          cantidad_solicitada: number
          comprado: boolean
          created_at: string
          id: string
          lista_id: string
          precio_estimado: number | null
          precio_final: number | null
          precio_unitario: number | null
          producto_id: string
          supermercado_id: string | null
          tipo_descuento: Database["public"]["Enums"]["tipo_descuento"]
          updated_at: string
          valor_descuento: number | null
        }
        Insert: {
          cantidad_comprada?: number | null
          cantidad_solicitada?: number
          comprado?: boolean
          created_at?: string
          id?: string
          lista_id: string
          precio_estimado?: number | null
          precio_final?: number | null
          precio_unitario?: number | null
          producto_id: string
          supermercado_id?: string | null
          tipo_descuento?: Database["public"]["Enums"]["tipo_descuento"]
          updated_at?: string
          valor_descuento?: number | null
        }
        Update: {
          cantidad_comprada?: number | null
          cantidad_solicitada?: number
          comprado?: boolean
          created_at?: string
          id?: string
          lista_id?: string
          precio_estimado?: number | null
          precio_final?: number | null
          precio_unitario?: number | null
          producto_id?: string
          supermercado_id?: string | null
          tipo_descuento?: Database["public"]["Enums"]["tipo_descuento"]
          updated_at?: string
          valor_descuento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "detalle_lista_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_lista_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_lista_supermercado_id_fkey"
            columns: ["supermercado_id"]
            isOneToOne: false
            referencedRelation: "supermercados"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_hogar: {
        Row: {
          cantidad_actual: number
          created_at: string
          estado_stock: string | null
          fecha_vencimiento: string | null
          id: string
          producto_id: string
          stock_minimo: number
          unidad_medida: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cantidad_actual?: number
          created_at?: string
          estado_stock?: string | null
          fecha_vencimiento?: string | null
          id?: string
          producto_id: string
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cantidad_actual?: number
          created_at?: string
          estado_stock?: string | null
          fecha_vencimiento?: string | null
          id?: string
          producto_id?: string
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_hogar_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_base"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_compra: {
        Row: {
          completed_at: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_lista"]
          id: string
          nombre: string
          supermercado_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_lista"]
          id?: string
          nombre?: string
          supermercado_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_lista"]
          id?: string
          nombre?: string
          supermercado_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_compra_supermercado_id_fkey"
            columns: ["supermercado_id"]
            isOneToOne: false
            referencedRelation: "supermercados"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_historico: {
        Row: {
          fecha_registro: string
          fuente: Database["public"]["Enums"]["fuente_precio"]
          id: string
          precio: number
          precio_final: number
          producto_id: string
          supermercado_id: string | null
          tipo_descuento: Database["public"]["Enums"]["tipo_descuento"]
          user_id: string
          valor_descuento: number | null
        }
        Insert: {
          fecha_registro?: string
          fuente?: Database["public"]["Enums"]["fuente_precio"]
          id?: string
          precio: number
          precio_final: number
          producto_id: string
          supermercado_id?: string | null
          tipo_descuento?: Database["public"]["Enums"]["tipo_descuento"]
          user_id: string
          valor_descuento?: number | null
        }
        Update: {
          fecha_registro?: string
          fuente?: Database["public"]["Enums"]["fuente_precio"]
          id?: string
          precio?: number
          precio_final?: number
          producto_id?: string
          supermercado_id?: string | null
          tipo_descuento?: Database["public"]["Enums"]["tipo_descuento"]
          user_id?: string
          valor_descuento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "precios_historico_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_historico_supermercado_id_fkey"
            columns: ["supermercado_id"]
            isOneToOne: false
            referencedRelation: "supermercados"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_base: {
        Row: {
          categoria_id: string
          codigo_barras: string | null
          created_at: string
          id: string
          imagen_url: string | null
          marca: string | null
          nombre: string
          unidad_medida: string
        }
        Insert: {
          categoria_id: string
          codigo_barras?: string | null
          created_at?: string
          id?: string
          imagen_url?: string | null
          marca?: string | null
          nombre: string
          unidad_medida?: string
        }
        Update: {
          categoria_id?: string
          codigo_barras?: string | null
          created_at?: string
          id?: string
          imagen_url?: string | null
          marca?: string | null
          nombre?: string
          unidad_medida?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_base_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      supermercados: {
        Row: {
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          user_id: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vista_gasto_mensual: {
        Row: {
          cantidad_compras: number | null
          gasto_total: number | null
          mes: string | null
          user_id: string | null
        }
        Relationships: []
      }
      vista_mejor_supermercado_producto: {
        Row: {
          precio_promedio: number | null
          producto_id: string | null
          producto_nombre: string | null
          supermercado_id: string | null
          supermercado_nombre: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precios_historico_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_historico_supermercado_id_fkey"
            columns: ["supermercado_id"]
            isOneToOne: false
            referencedRelation: "supermercados"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_tendencia_precio: {
        Row: {
          fecha_registro: string | null
          precio_final: number | null
          precio_unitario: number | null
          producto_id: string | null
          producto_nombre: string | null
          supermercado_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precios_historico_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_historico_supermercado_id_fkey"
            columns: ["supermercado_id"]
            isOneToOne: false
            referencedRelation: "supermercados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      buscar_producto_similar: {
        Args: { limite?: number; texto_busqueda: string }
        Returns: {
          categoria_icono: string
          categoria_id: string
          categoria_nombre: string
          codigo_barras: string
          id: string
          marca: string
          nombre: string
          origen: string
          similitud: number
          unidad_medida: string
        }[]
      }
      fn_calcular_precio_final: {
        Args: {
          p_precio_unitario: number
          p_tipo_descuento: Database["public"]["Enums"]["tipo_descuento"]
          p_valor_descuento: number
        }
        Returns: number
      }
      fn_generar_lista_compra: { Args: never; Returns: string }
      fn_generar_lista_compra_interna: {
        Args: { p_user_id: string }
        Returns: string
      }
      fn_generar_listas_automaticas: { Args: never; Returns: undefined }
      inmutable_unaccent: { Args: { "": string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      estado_lista: "activa" | "completada" | "cancelada"
      fuente_precio: "manual" | "ocr_ticket" | "lista_compra"
      tipo_descuento:
        | "ninguno"
        | "2x1"
        | "descuento_2da_unidad"
        | "porcentaje"
        | "monto_fijo"
        | "nxm"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_lista: ["activa", "completada", "cancelada"],
      fuente_precio: ["manual", "ocr_ticket", "lista_compra"],
      tipo_descuento: [
        "ninguno",
        "2x1",
        "descuento_2da_unidad",
        "porcentaje",
        "monto_fijo",
        "nxm",
      ],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Alias de conveniencia usados por hooks/ y screens/ (a mano, mantener en
// sync con las columnas de arriba si cambia el schema).
// ---------------------------------------------------------------------------

export type Categoria = Tables<"categorias">
export type Supermercado = Tables<"supermercados">
export type EstadoLista = Database["public"]["Enums"]["estado_lista"]
export type FuentePrecio = Database["public"]["Enums"]["fuente_precio"]
export type TipoDescuento = Database["public"]["Enums"]["tipo_descuento"]
export type EstadoStock = "rojo" | "amarillo" | "verde"

export type ProductoBase = Database["public"]["Tables"]["productos_base"]["Row"]

export type InventarioItem = Omit<
  Database["public"]["Tables"]["inventario_hogar"]["Row"],
  "estado_stock"
> & {
  estado_stock: EstadoStock
  // Join con productos_base (via select con !inner o foreign table)
  producto?: ProductoBase
}

export type ListaCompra = Database["public"]["Tables"]["listas_compra"]["Row"]

export type DetalleListaItem = Database["public"]["Tables"]["detalle_lista"]["Row"] & {
  producto?: ProductoBase
}

// Las 3 vistas salen "nullable" del generador (Postgres no expone NOT
// NULL a través de vistas), pero en la práctica nunca lo son: agregan
// sobre columnas NOT NULL de precios_historico y usan join interno con
// productos_base/supermercados. Redefinidas no-nulas acá, igual que
// InventarioItem arriba con estado_stock.
export type GastoMensual = {
  [K in keyof Database["public"]["Views"]["vista_gasto_mensual"]["Row"]]: NonNullable<
    Database["public"]["Views"]["vista_gasto_mensual"]["Row"][K]
  >
}
export type MejorSupermercadoProducto = {
  [K in keyof Database["public"]["Views"]["vista_mejor_supermercado_producto"]["Row"]]: NonNullable<
    Database["public"]["Views"]["vista_mejor_supermercado_producto"]["Row"][K]
  >
}
export type TendenciaPrecio = Omit<
  {
    [K in keyof Database["public"]["Views"]["vista_tendencia_precio"]["Row"]]: NonNullable<
      Database["public"]["Views"]["vista_tendencia_precio"]["Row"][K]
    >
  },
  "supermercado_id"
> & {
  // Único campo genuinamente nullable: detalle_lista/precios_historico
  // permite cargar un precio sin especificar en qué supermercado.
  supermercado_id: string | null
}
