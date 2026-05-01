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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_conversation_logs: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          user_email: string | null
          username: string | null
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          user_email?: string | null
          username?: string | null
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          user_email?: string | null
          username?: string | null
        }
        Relationships: []
      }
      ai_instructions: {
        Row: {
          id: string
          instructions: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructions?: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_learnings: {
        Row: {
          id: string
          learnings: string
          updated_at: string
        }
        Insert: {
          id?: string
          learnings?: string
          updated_at?: string
        }
        Update: {
          id?: string
          learnings?: string
          updated_at?: string
        }
        Relationships: []
      }
      container_credits_ledger: {
        Row: {
          container_id: string | null
          created_at: string
          created_by: string | null
          customer_account_id: string
          delta: number
          id: string
          note: string | null
          reason: string
        }
        Insert: {
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id: string
          delta: number
          id?: string
          note?: string | null
          reason: string
        }
        Update: {
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_credits_ledger_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_credits_ledger_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_balance"
            referencedColumns: ["customer_account_id"]
          },
        ]
      }
      crm_settings: {
        Row: {
          id: string
          updated_at: string
          visible_user_ids: string[]
        }
        Insert: {
          id?: string
          updated_at?: string
          visible_user_ids?: string[]
        }
        Update: {
          id?: string
          updated_at?: string
          visible_user_ids?: string[]
        }
        Relationships: []
      }
      customer_accounts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_cycle: string
          can_see_trials: boolean
          company_name: string | null
          contact_email: string | null
          created_at: string
          customer_account_id: string
          id: string
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_cycle?: string
          can_see_trials?: boolean
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          customer_account_id: string
          id?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_cycle?: string
          can_see_trials?: boolean
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          customer_account_id?: string
          id?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_geocode_cache: {
        Row: {
          address_key: string
          created_at: string
          lat: number | null
          lon: number | null
          name_hint: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          address_key: string
          created_at?: string
          lat?: number | null
          lon?: number | null
          name_hint?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          address_key?: string
          created_at?: string
          lat?: number | null
          lon?: number | null
          name_hint?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_invitations: {
        Row: {
          billing_cycle: string
          can_see_trials: boolean
          code: string
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_account_id: string
          id: string
          notes: string | null
          tier: string
          used_at: string | null
          used_by_user_id: string | null
          username: string | null
        }
        Insert: {
          billing_cycle?: string
          can_see_trials?: boolean
          code: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id: string
          id?: string
          notes?: string | null
          tier?: string
          used_at?: string | null
          used_by_user_id?: string | null
          username?: string | null
        }
        Update: {
          billing_cycle?: string
          can_see_trials?: boolean
          code?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id?: string
          id?: string
          notes?: string | null
          tier?: string
          used_at?: string | null
          used_by_user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      data_loggers_report_cache: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          week_nr: number
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          week_nr: number
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          week_nr?: number
        }
        Relationships: []
      }
      exception_report_cache: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          week_nr: number
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          week_nr: number
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          week_nr?: number
        }
        Relationships: []
      }
      login_logs: {
        Row: {
          city: string | null
          country: string | null
          email: string
          id: string
          ip_address: string | null
          logged_in_at: string
          region: string | null
          user_id: string
          username: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          email: string
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          region?: string | null
          user_id: string
          username: string
        }
        Update: {
          city?: string | null
          country?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          region?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      question_logs: {
        Row: {
          asked_at: string
          city: string | null
          country: string | null
          id: string
          question: string
          region: string | null
          user_email: string | null
          username: string | null
        }
        Insert: {
          asked_at?: string
          city?: string | null
          country?: string | null
          id?: string
          question: string
          region?: string | null
          user_email?: string | null
          username?: string | null
        }
        Update: {
          asked_at?: string
          city?: string | null
          country?: string | null
          id?: string
          question?: string
          region?: string | null
          user_email?: string | null
          username?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          permissions: Json
          role_key: string
          updated_at: string
        }
        Insert: {
          id?: string
          permissions?: Json
          role_key: string
          updated_at?: string
        }
        Update: {
          id?: string
          permissions?: Json
          role_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      seasonality_report_cache: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          week_nr: number
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          week_nr: number
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          week_nr?: number
        }
        Relationships: []
      }
      sensiwatch_activations: {
        Row: {
          activation_time: string | null
          device_name: string | null
          id: string
          org_unit: string | null
          raw: Json
          received_at: string
          serial_number: string | null
        }
        Insert: {
          activation_time?: string | null
          device_name?: string | null
          id?: string
          org_unit?: string | null
          raw: Json
          received_at?: string
          serial_number?: string | null
        }
        Update: {
          activation_time?: string | null
          device_name?: string | null
          id?: string
          org_unit?: string | null
          raw?: Json
          received_at?: string
          serial_number?: string | null
        }
        Relationships: []
      }
      sensiwatch_reports: {
        Row: {
          container_number: string | null
          destinations: Json | null
          device_name: string | null
          id: string
          internal_trip_id: string | null
          last_address: string | null
          last_device_time: string | null
          last_humidity: number | null
          last_latitude: number | null
          last_light: number | null
          last_longitude: number | null
          last_receive_time: string | null
          last_temp: number | null
          mode_of_transport: string | null
          raw: Json
          received_at: string
          serial_number: string | null
          trailer_id: string | null
          trip_guid: string | null
          trip_id: string | null
        }
        Insert: {
          container_number?: string | null
          destinations?: Json | null
          device_name?: string | null
          id?: string
          internal_trip_id?: string | null
          last_address?: string | null
          last_device_time?: string | null
          last_humidity?: number | null
          last_latitude?: number | null
          last_light?: number | null
          last_longitude?: number | null
          last_receive_time?: string | null
          last_temp?: number | null
          mode_of_transport?: string | null
          raw: Json
          received_at?: string
          serial_number?: string | null
          trailer_id?: string | null
          trip_guid?: string | null
          trip_id?: string | null
        }
        Update: {
          container_number?: string | null
          destinations?: Json | null
          device_name?: string | null
          id?: string
          internal_trip_id?: string | null
          last_address?: string | null
          last_device_time?: string | null
          last_humidity?: number | null
          last_latitude?: number | null
          last_light?: number | null
          last_longitude?: number | null
          last_receive_time?: string | null
          last_temp?: number | null
          mode_of_transport?: string | null
          raw?: Json
          received_at?: string
          serial_number?: string | null
          trailer_id?: string | null
          trip_guid?: string | null
          trip_id?: string | null
        }
        Relationships: []
      }
      sf_hidden_trips: {
        Row: {
          created_at: string
          hidden_by: string | null
          id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          hidden_by?: string | null
          id?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          hidden_by?: string | null
          id?: string
          trip_id?: string
        }
        Relationships: []
      }
      shared_pages: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_username: string | null
          expires_at: string
          id: string
          page_type: string
          payload: Json
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_username?: string | null
          expires_at: string
          id?: string
          page_type: string
          payload: Json
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_username?: string | null
          expires_at?: string
          id?: string
          page_type?: string
          payload?: Json
          token?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vaselife_headers: {
        Row: {
          conclusion: string | null
          created_at: string
          crop: string | null
          cultivar_count: number | null
          customer: string | null
          farm: string | null
          freight_type: string | null
          harvest_date: string | null
          id: string
          initial_quality: string | null
          objective: string | null
          recommendations: string | null
          source_date: string | null
          spec_comments: string | null
          start_retail: string | null
          start_seafreight: string | null
          start_transport: string | null
          start_vl: string | null
          stems_per_vase: number | null
          total_vases: number | null
          treatment_count: number | null
          trial_number: string | null
          updated_at: string
          vases_per_treatment: number | null
        }
        Insert: {
          conclusion?: string | null
          created_at?: string
          crop?: string | null
          cultivar_count?: number | null
          customer?: string | null
          farm?: string | null
          freight_type?: string | null
          harvest_date?: string | null
          id: string
          initial_quality?: string | null
          objective?: string | null
          recommendations?: string | null
          source_date?: string | null
          spec_comments?: string | null
          start_retail?: string | null
          start_seafreight?: string | null
          start_transport?: string | null
          start_vl?: string | null
          stems_per_vase?: number | null
          total_vases?: number | null
          treatment_count?: number | null
          trial_number?: string | null
          updated_at?: string
          vases_per_treatment?: number | null
        }
        Update: {
          conclusion?: string | null
          created_at?: string
          crop?: string | null
          cultivar_count?: number | null
          customer?: string | null
          farm?: string | null
          freight_type?: string | null
          harvest_date?: string | null
          id?: string
          initial_quality?: string | null
          objective?: string | null
          recommendations?: string | null
          source_date?: string | null
          spec_comments?: string | null
          start_retail?: string | null
          start_seafreight?: string | null
          start_transport?: string | null
          start_vl?: string | null
          stems_per_vase?: number | null
          total_vases?: number | null
          treatment_count?: number | null
          trial_number?: string | null
          updated_at?: string
          vases_per_treatment?: number | null
        }
        Relationships: []
      }
      vaselife_measurements: {
        Row: {
          created_at: string
          cultivar: string | null
          id_cultivar: string | null
          id_header: string
          id_line: string
          id_line_property: string
          id_property: string | null
          observation_count: number | null
          observation_days: number | null
          property_name: string | null
          score: number | null
          source_date: string | null
          treatment_no: number | null
        }
        Insert: {
          created_at?: string
          cultivar?: string | null
          id_cultivar?: string | null
          id_header: string
          id_line: string
          id_line_property: string
          id_property?: string | null
          observation_count?: number | null
          observation_days?: number | null
          property_name?: string | null
          score?: number | null
          source_date?: string | null
          treatment_no?: number | null
        }
        Update: {
          created_at?: string
          cultivar?: string | null
          id_cultivar?: string | null
          id_header?: string
          id_line?: string
          id_line_property?: string
          id_property?: string | null
          observation_count?: number | null
          observation_days?: number | null
          property_name?: string | null
          score?: number | null
          source_date?: string | null
          treatment_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vaselife_measurements_id_header_fkey"
            columns: ["id_header"]
            isOneToOne: false
            referencedRelation: "vaselife_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      vaselife_trial_ai_analysis: {
        Row: {
          analysis: string
          created_at: string
          created_by: string | null
          header_id: string
          id: string
          model: string | null
          updated_at: string
        }
        Insert: {
          analysis: string
          created_at?: string
          created_by?: string | null
          header_id: string
          id?: string
          model?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: string
          created_at?: string
          created_by?: string | null
          header_id?: string
          id?: string
          model?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vaselife_vases: {
        Row: {
          bot_percentage: number | null
          climate_room: string | null
          consumer_phase: string | null
          created_at: string
          cultivar: string | null
          flo_percentage: number | null
          flv_days: number | null
          id_cultivar: string | null
          id_dipping: string | null
          id_greenhouse: string | null
          id_header: string
          id_line: string
          id_pulsing: string | null
          post_harvest: string | null
          source_date: string | null
          store_phase: string | null
          treatment_name: string | null
          treatment_no: number | null
          vase_count: number | null
        }
        Insert: {
          bot_percentage?: number | null
          climate_room?: string | null
          consumer_phase?: string | null
          created_at?: string
          cultivar?: string | null
          flo_percentage?: number | null
          flv_days?: number | null
          id_cultivar?: string | null
          id_dipping?: string | null
          id_greenhouse?: string | null
          id_header: string
          id_line: string
          id_pulsing?: string | null
          post_harvest?: string | null
          source_date?: string | null
          store_phase?: string | null
          treatment_name?: string | null
          treatment_no?: number | null
          vase_count?: number | null
        }
        Update: {
          bot_percentage?: number | null
          climate_room?: string | null
          consumer_phase?: string | null
          created_at?: string
          cultivar?: string | null
          flo_percentage?: number | null
          flv_days?: number | null
          id_cultivar?: string | null
          id_dipping?: string | null
          id_greenhouse?: string | null
          id_header?: string
          id_line?: string
          id_pulsing?: string | null
          post_harvest?: string | null
          source_date?: string | null
          store_phase?: string | null
          treatment_name?: string | null
          treatment_no?: number | null
          vase_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vaselife_vases_id_header_fkey"
            columns: ["id_header"]
            isOneToOne: false
            referencedRelation: "vaselife_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      vesselfinder_tracking: {
        Row: {
          container_id: string
          container_number_override: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          error_code: string | null
          error_message: string | null
          id: string
          last_polled_at: string | null
          response: Json | null
          sealine: string | null
          status: string
          updated_at: string
        }
        Insert: {
          container_id: string
          container_number_override?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_polled_at?: string | null
          response?: Json | null
          sealine?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          container_id?: string
          container_number_override?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_polled_at?: string | null
          response?: Json | null
          sealine?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_plan_cache: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          week_nr: number
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          week_nr: number
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          week_nr?: number
        }
        Relationships: []
      }
    }
    Views: {
      customer_credit_balance: {
        Row: {
          balance: number | null
          customer_account_id: string | null
          tier: string | null
          total_consumed: number | null
          total_granted: number | null
          user_id: string | null
        }
        Relationships: []
      }
      sensiwatch_trip_latest: {
        Row: {
          container_number: string | null
          destinations: Json | null
          device_name: string | null
          internal_trip_id: string | null
          is_backfill_only: boolean | null
          last_address: string | null
          last_device_time: string | null
          last_humidity: number | null
          last_latitude: number | null
          last_light: number | null
          last_longitude: number | null
          last_receive_time: string | null
          last_temp: number | null
          mode_of_transport: string | null
          received_at: string | null
          serial_number: string | null
          trailer_id: string | null
          trip_guid: string | null
          trip_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      monthly_grant_credits: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "customer" | "ta"
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
      app_role: ["admin", "user", "customer", "ta"],
    },
  },
} as const
