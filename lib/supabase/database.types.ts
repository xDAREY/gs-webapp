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
    PostgrestVersion: "14.15"
  }
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
      audit_events: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_name: string
          actor_nurse_id: string | null
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_supervisor_id: string | null
          created_at: string
          id: string
          patient_ids: string[]
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_name: string
          actor_nurse_id?: string | null
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_supervisor_id?: string | null
          created_at?: string
          id?: string
          patient_ids?: string[]
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_name?: string
          actor_nurse_id?: string | null
          actor_role?: Database["public"]["Enums"]["actor_role"]
          actor_supervisor_id?: string | null
          created_at?: string
          id?: string
          patient_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_nurse_id_fkey"
            columns: ["actor_nurse_id"]
            isOneToOne: false
            referencedRelation: "nurses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_actor_supervisor_id_fkey"
            columns: ["actor_supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          administered_at: string | null
          care_status: Database["public"]["Enums"]["entry_care_status"] | null
          created_at: string
          detail: string
          dose: string | null
          drug: string | null
          id: string
          kind: Database["public"]["Enums"]["entry_kind"]
          length_of_event: string | null
          med_status: Database["public"]["Enums"]["medication_status"] | null
          observations: string[]
          occurred_at: string
          reason: string | null
          route: string | null
          shift_id: string
          tags: string[]
          tasks: string[]
          timeframe: string | null
        }
        Insert: {
          administered_at?: string | null
          care_status?: Database["public"]["Enums"]["entry_care_status"] | null
          created_at?: string
          detail: string
          dose?: string | null
          drug?: string | null
          id?: string
          kind: Database["public"]["Enums"]["entry_kind"]
          length_of_event?: string | null
          med_status?: Database["public"]["Enums"]["medication_status"] | null
          observations?: string[]
          occurred_at?: string
          reason?: string | null
          route?: string | null
          shift_id: string
          tags?: string[]
          tasks?: string[]
          timeframe?: string | null
        }
        Update: {
          administered_at?: string | null
          care_status?: Database["public"]["Enums"]["entry_care_status"] | null
          created_at?: string
          detail?: string
          dose?: string | null
          drug?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          length_of_event?: string | null
          med_status?: Database["public"]["Enums"]["medication_status"] | null
          observations?: string[]
          occurred_at?: string
          reason?: string | null
          route?: string | null
          shift_id?: string
          tags?: string[]
          tasks?: string[]
          timeframe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          nurse_id: string
          read: boolean
          shift_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          nurse_id: string
          read?: boolean
          shift_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          nurse_id?: string
          read?: boolean
          shift_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "nurses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_credentials: {
        Row: {
          nurse_id: string
          pin_hash: string
        }
        Insert: {
          nurse_id: string
          pin_hash: string
        }
        Update: {
          nurse_id?: string
          pin_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurse_credentials_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: true
            referencedRelation: "nurses"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_patient_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          nurse_id: string
          patient_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          nurse_id: string
          patient_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          nurse_id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurse_patient_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurse_patient_assignments_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "nurses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurse_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      nurses: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          must_reset_pin: boolean
          name: string
          phone: string
          status: Database["public"]["Enums"]["nurse_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          must_reset_pin?: boolean
          name: string
          phone: string
          status?: Database["public"]["Enums"]["nurse_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          must_reset_pin?: boolean
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["nurse_status"]
          updated_at?: string
        }
        Relationships: []
      }
      patient_diagnoses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          patient_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_diagnoses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          created_by: string | null
          dob: string
          id: string
          medicaid_number: string
          name: string
          room: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dob: string
          id?: string
          medicaid_number: string
          name: string
          room: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dob?: string
          id?: string
          medicaid_number?: string
          name?: string
          room?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_patients: {
        Row: {
          patient_id: string
          shift_id: string
        }
        Insert: {
          patient_id: string
          shift_id: string
        }
        Update: {
          patient_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_patients_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          ended_at: string | null
          follow_up: boolean
          id: string
          incident: boolean
          nurse_id: string
          observations: string | null
          recommendations: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature: string | null
          started_at: string
          status: Database["public"]["Enums"]["shift_status"]
          submitted_at: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          follow_up?: boolean
          id?: string
          incident?: boolean
          nurse_id: string
          observations?: string | null
          recommendations?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["shift_status"]
          submitted_at?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          follow_up?: boolean
          id?: string
          incident?: boolean
          nurse_id?: string
          observations?: string | null
          recommendations?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["shift_status"]
          submitted_at?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "nurses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_credentials: {
        Row: {
          pin_hash: string
          supervisor_id: string
        }
        Insert: {
          pin_hash: string
          supervisor_id: string
        }
        Update: {
          pin_hash?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_credentials_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: true
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisors: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_nurse_id: { Args: never; Returns: string }
      current_supervisor_id: { Args: never; Returns: string }
      is_own_shift: { Args: { p_shift_id: string }; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      register_nurse: {
        Args: { p_name: string; p_phone: string; p_pin: string }
        Returns: string
      }
      register_supervisor: {
        Args: { p_name: string; p_phone: string; p_pin: string }
        Returns: string
      }
      reset_nurse_pin: {
        Args: { p_new_pin: string; p_nurse_id: string }
        Returns: undefined
      }
      set_own_nurse_pin: { Args: { p_new_pin: string }; Returns: undefined }
      verify_nurse_login: {
        Args: { p_phone: string; p_pin: string }
        Returns: {
          must_reset_pin: boolean
          name: string
          nurse_id: string
          status: Database["public"]["Enums"]["nurse_status"]
        }[]
      }
      verify_supervisor_login: {
        Args: { p_phone: string; p_pin: string }
        Returns: {
          name: string
          supervisor_id: string
        }[]
      }
    }
    Enums: {
      actor_role: "nurse" | "supervisor"
      audit_action:
        | "account_created"
        | "login"
        | "logout"
        | "session_timeout"
        | "viewed"
        | "created"
        | "edited"
        | "submitted"
        | "approved"
        | "rejected"
        | "pin_reset"
        | "assigned"
        | "nurse_approved"
      entry_care_status: "Stable" | "Needs attention"
      entry_kind: "note" | "medication" | "incident" | "task"
      medication_status: "Given" | "Refused"
      notification_type: "approved" | "rejected"
      nurse_status: "pending" | "approved"
      shift_status: "in_progress" | "submitted" | "approved" | "rejected"
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
      actor_role: ["nurse", "supervisor"],
      audit_action: [
        "account_created",
        "login",
        "logout",
        "session_timeout",
        "viewed",
        "created",
        "edited",
        "submitted",
        "approved",
        "rejected",
        "pin_reset",
        "assigned",
        "nurse_approved",
      ],
      entry_care_status: ["Stable", "Needs attention"],
      entry_kind: ["note", "medication", "incident", "task"],
      medication_status: ["Given", "Refused"],
      notification_type: ["approved", "rejected"],
      nurse_status: ["pending", "approved"],
      shift_status: ["in_progress", "submitted", "approved", "rejected"],
    },
  },
} as const
