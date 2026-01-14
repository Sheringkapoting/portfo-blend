export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      holdings: {
        Row: {
          avg_price: number
          created_at: string
          exchange: string
          id: string
          isin: string | null
          ltp: number
          name: string
          quantity: number
          sector: string
          source: string
          symbol: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avg_price: number
          created_at?: string
          exchange: string
          id?: string
          isin?: string | null
          ltp: number
          name: string
          quantity: number
          sector: string
          source: string
          symbol: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avg_price?: number
          created_at?: string
          exchange?: string
          id?: string
          isin?: string | null
          ltp?: number
          name?: string
          quantity?: number
          sector?: string
          source?: string
          symbol?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      kite_sessions: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          token_type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          token_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          token_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          current_value: number
          holdings_count: number
          id: string
          pnl_percent: number
          snapshot_date: string
          total_investment: number
          total_pnl: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_value?: number
          holdings_count?: number
          id?: string
          pnl_percent?: number
          snapshot_date?: string
          total_investment?: number
          total_pnl?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_value?: number
          holdings_count?: number
          id?: string
          pnl_percent?: number
          snapshot_date?: string
          total_investment?: number
          total_pnl?: number
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes_cache: {
        Row: {
          change_percent: number | null
          fetched_at: string
          id: string
          ltp: number
          source: string
          symbol: string
          volume: number | null
        }
        Insert: {
          change_percent?: number | null
          fetched_at?: string
          id?: string
          ltp: number
          source: string
          symbol: string
          volume?: number | null
        }
        Update: {
          change_percent?: number | null
          fetched_at?: string
          id?: string
          ltp?: number
          source?: string
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      snapshot_source_details: {
        Row: {
          asset_type: string | null
          created_at: string | null
          current_value: number | null
          holdings_count: number | null
          id: string
          last_sync_at: string | null
          snapshot_id: string | null
          source: string
          total_investment: number | null
          total_pnl: number | null
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          current_value?: number | null
          holdings_count?: number | null
          id?: string
          last_sync_at?: string | null
          snapshot_id?: string | null
          source: string
          total_investment?: number | null
          total_pnl?: number | null
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          current_value?: number | null
          holdings_count?: number | null
          id?: string
          last_sync_at?: string | null
          snapshot_id?: string | null
          source?: string
          total_investment?: number | null
          total_pnl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_source_details_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "portfolio_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          holdings_count: number | null
          id: string
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          holdings_count?: number | null
          id?: string
          source: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          holdings_count?: number | null
          id?: string
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
