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
      accounts: {
        Row: {
          color: string | null
          created_at: string
          hsbc_account_id: string | null
          icon: string | null
          id: string
          include_in_net_worth: boolean | null
          investment_provider: string | null
          investment_type: string | null
          is_active: boolean
          is_archived: boolean | null
          last_import_at: string | null
          name: string
          notes: string | null
          provider: string
          sort_order: number | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          hsbc_account_id?: string | null
          icon?: string | null
          id?: string
          include_in_net_worth?: boolean | null
          investment_provider?: string | null
          investment_type?: string | null
          is_active?: boolean
          is_archived?: boolean | null
          last_import_at?: string | null
          name: string
          notes?: string | null
          provider: string
          sort_order?: number | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          hsbc_account_id?: string | null
          icon?: string | null
          id?: string
          include_in_net_worth?: boolean | null
          investment_provider?: string | null
          investment_type?: string | null
          is_active?: boolean
          is_archived?: boolean | null
          last_import_at?: string | null
          name?: string
          notes?: string | null
          provider?: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      ai_mapping_cache: {
        Row: {
          confidence: number
          created_at: string | null
          headers: Json
          headers_hash: string
          hits: number | null
          id: string
          last_used_at: string | null
          result: Json
        }
        Insert: {
          confidence: number
          created_at?: string | null
          headers: Json
          headers_hash: string
          hits?: number | null
          id?: string
          last_used_at?: string | null
          result: Json
        }
        Update: {
          confidence?: number
          created_at?: string | null
          headers?: Json
          headers_hash?: string
          hits?: number | null
          id?: string
          last_used_at?: string | null
          result?: Json
        }
        Relationships: []
      }
      ai_usage_tracking: {
        Row: {
          count: number | null
          date: string
          id: string
          usage_type: string
        }
        Insert: {
          count?: number | null
          date?: string
          id?: string
          usage_type: string
        }
        Update: {
          count?: number | null
          date?: string
          id?: string
          usage_type?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          month: number
          year: number
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          month: number
          year: number
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          group_name: string
          id: string
          is_income: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          group_name: string
          id?: string
          is_income?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          group_name?: string
          id?: string
          is_income?: boolean
          name?: string
        }
        Relationships: []
      }
      category_corrections: {
        Row: {
          corrected_category_id: string
          created_at: string | null
          created_rule_id: string | null
          description: string
          id: string
          import_session_id: string | null
          original_category_id: string | null
          original_source: string | null
        }
        Insert: {
          corrected_category_id: string
          created_at?: string | null
          created_rule_id?: string | null
          description: string
          id?: string
          import_session_id?: string | null
          original_category_id?: string | null
          original_source?: string | null
        }
        Update: {
          corrected_category_id?: string
          created_at?: string | null
          created_rule_id?: string | null
          description?: string
          id?: string
          import_session_id?: string | null
          original_category_id?: string | null
          original_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_corrections_corrected_category_id_fkey"
            columns: ["corrected_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_corrections_created_rule_id_fkey"
            columns: ["created_rule_id"]
            isOneToOne: false
            referencedRelation: "category_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_corrections_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_corrections_original_category_id_fkey"
            columns: ["original_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          category_id: string
          confidence: number
          created_at: string
          id: string
          is_system: boolean | null
          match_type: Database["public"]["Enums"]["match_type"]
          notes: string | null
          pattern: string
        }
        Insert: {
          category_id: string
          confidence?: number
          created_at?: string
          id?: string
          is_system?: boolean | null
          match_type?: Database["public"]["Enums"]["match_type"]
          notes?: string | null
          pattern: string
        }
        Update: {
          category_id?: string
          confidence?: number
          created_at?: string
          id?: string
          is_system?: boolean | null
          match_type?: Database["public"]["Enums"]["match_type"]
          notes?: string | null
          pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fire_inputs: {
        Row: {
          annual_income: number | null
          annual_savings: number | null
          current_age: number
          current_portfolio_value: number | null
          id: string
          include_state_pension: boolean | null
          partner_state_pension: boolean | null
          target_retirement_age: number | null
          updated_at: string | null
        }
        Insert: {
          annual_income?: number | null
          annual_savings?: number | null
          current_age: number
          current_portfolio_value?: number | null
          id?: string
          include_state_pension?: boolean | null
          partner_state_pension?: boolean | null
          target_retirement_age?: number | null
          updated_at?: string | null
        }
        Update: {
          annual_income?: number | null
          annual_savings?: number | null
          current_age?: number
          current_portfolio_value?: number | null
          id?: string
          include_state_pension?: boolean | null
          partner_state_pension?: boolean | null
          target_retirement_age?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fire_parameters: {
        Row: {
          annual_spend: number
          created_at: string
          expected_return: number
          id: string
          retirement_age: number
          scenario_name: string
          state_pension_age: number
          state_pension_amount: number
          withdrawal_rate: number
        }
        Insert: {
          annual_spend: number
          created_at?: string
          expected_return: number
          id?: string
          retirement_age: number
          scenario_name: string
          state_pension_age: number
          state_pension_amount: number
          withdrawal_rate: number
        }
        Update: {
          annual_spend?: number
          created_at?: string
          expected_return?: number
          id?: string
          retirement_age?: number
          scenario_name?: string
          state_pension_age?: number
          state_pension_amount?: number
          withdrawal_rate?: number
        }
        Relationships: []
      }
      fire_scenarios: {
        Row: {
          annual_spend: number
          created_at: string | null
          description: string | null
          expected_return: number | null
          id: string
          inflation_rate: number | null
          is_default: boolean | null
          name: string
          retirement_age: number | null
          sort_order: number | null
          state_pension_age: number | null
          state_pension_annual: number | null
          updated_at: string | null
          withdrawal_rate: number | null
        }
        Insert: {
          annual_spend: number
          created_at?: string | null
          description?: string | null
          expected_return?: number | null
          id?: string
          inflation_rate?: number | null
          is_default?: boolean | null
          name: string
          retirement_age?: number | null
          sort_order?: number | null
          state_pension_age?: number | null
          state_pension_annual?: number | null
          updated_at?: string | null
          withdrawal_rate?: number | null
        }
        Update: {
          annual_spend?: number
          created_at?: string | null
          description?: string | null
          expected_return?: number | null
          id?: string
          inflation_rate?: number | null
          is_default?: boolean | null
          name?: string
          retirement_age?: number | null
          sort_order?: number | null
          state_pension_age?: number | null
          state_pension_annual?: number | null
          updated_at?: string | null
          withdrawal_rate?: number | null
        }
        Relationships: []
      }
      import_formats: {
        Row: {
          amount_column: string | null
          amount_in_single_column: boolean
          column_mapping: Json
          created_at: string
          credit_column: string | null
          date_format: string
          debit_column: string | null
          decimal_separator: string
          has_header: boolean
          id: string
          is_system: boolean
          last_used_at: string | null
          name: string
          notes: string | null
          provider: string
          sample_headers: Json | null
          skip_rows: number
          updated_at: string
          use_count: number | null
        }
        Insert: {
          amount_column?: string | null
          amount_in_single_column?: boolean
          column_mapping: Json
          created_at?: string
          credit_column?: string | null
          date_format?: string
          debit_column?: string | null
          decimal_separator?: string
          has_header?: boolean
          id?: string
          is_system?: boolean
          last_used_at?: string | null
          name: string
          notes?: string | null
          provider: string
          sample_headers?: Json | null
          skip_rows?: number
          updated_at?: string
          use_count?: number | null
        }
        Update: {
          amount_column?: string | null
          amount_in_single_column?: boolean
          column_mapping?: Json
          created_at?: string
          credit_column?: string | null
          date_format?: string
          debit_column?: string | null
          decimal_separator?: string
          has_header?: boolean
          id?: string
          is_system?: boolean
          last_used_at?: string | null
          name?: string
          notes?: string | null
          provider?: string
          sample_headers?: Json | null
          skip_rows?: number
          updated_at?: string
          use_count?: number | null
        }
        Relationships: []
      }
      import_sessions: {
        Row: {
          account_id: string | null
          completed_at: string | null
          created_at: string
          duplicate_count: number
          error_count: number
          error_details: Json | null
          filename: string
          format_id: string | null
          id: string
          imported_count: number
          raw_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
        }
        Insert: {
          account_id?: string | null
          completed_at?: string | null
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_details?: Json | null
          filename: string
          format_id?: string | null
          id?: string
          imported_count?: number
          raw_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
        }
        Update: {
          account_id?: string | null
          completed_at?: string | null
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_details?: Json | null
          filename?: string
          format_id?: string | null
          id?: string
          imported_count?: number
          raw_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sessions_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "import_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_transaction_hashes: {
        Row: {
          created_at: string
          hash: string
          id: string
          import_session_id: string | null
          source_row: Json | null
          transaction_id: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          import_session_id?: string | null
          source_row?: Json | null
          transaction_id: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          import_session_id?: string | null
          source_row?: Json | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_transaction_hashes_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_transaction_hashes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_valuations: {
        Row: {
          account_id: string
          created_at: string | null
          date: string
          id: string
          notes: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          value: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_valuations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          categorisation_source: Database["public"]["Enums"]["categorisation_source"]
          category_id: string | null
          created_at: string
          date: string
          description: string
          hsbc_transaction_id: string | null
          id: string
          needs_review: boolean | null
        }
        Insert: {
          account_id: string
          amount: number
          categorisation_source?: Database["public"]["Enums"]["categorisation_source"]
          category_id?: string | null
          created_at?: string
          date: string
          description: string
          hsbc_transaction_id?: string | null
          id?: string
          needs_review?: boolean | null
        }
        Update: {
          account_id?: string
          amount?: number
          categorisation_source?: Database["public"]["Enums"]["categorisation_source"]
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          hsbc_transaction_id?: string | null
          id?: string
          needs_review?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_snapshots: {
        Row: {
          account_id: string
          balance: number
          created_at: string
          date: string
          id: string
          notes: string | null
        }
        Insert: {
          account_id: string
          balance: number
          created_at?: string
          date: string
          id?: string
          notes?: string | null
        }
        Update: {
          account_id?: string
          balance?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wealth_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_similar_transactions: {
        Args: {
          max_results?: number
          min_similarity?: number
          search_description: string
        }
        Returns: {
          category_id: string
          category_name: string
          date: string
          description: string
          id: string
          similarity: number
        }[]
      }
      get_account_transaction_stats: {
        Args: { account_ids: string[] }
        Returns: {
          account_id: string
          balance: number
          earliest_date: string
          latest_date: string
          tx_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_type:
        | "current"
        | "savings"
        | "pension"
        | "isa"
        | "investment"
        | "property"
        | "credit"
        | "other"
      categorisation_source: "manual" | "rule" | "ai" | "import"
      import_status: "pending" | "processing" | "completed" | "failed"
      match_type: "exact" | "contains" | "regex"
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
    Enums: {
      account_type: [
        "current",
        "savings",
        "pension",
        "isa",
        "investment",
        "property",
        "credit",
        "other",
      ],
      categorisation_source: ["manual", "rule", "ai", "import"],
      import_status: ["pending", "processing", "completed", "failed"],
      match_type: ["exact", "contains", "regex"],
    },
  },
} as const
