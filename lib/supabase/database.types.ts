// SINH TỰ ĐỘNG TỪ DB — KHÔNG SỬA TAY.
// Sinh lại sau mỗi lần đổi schema:
//   npx supabase gen types typescript --project-id abobwfohmyukuyxmtwgp > lib/supabase/database.types.ts
// (hoặc qua Supabase MCP: generate_typescript_types)

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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string
          body: string
          building_id: string | null
          created_at: string
          document_id: string | null
          floor_no: number | null
          id: string
          is_urgent: boolean
          project_id: string
          published_at: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          building_id?: string | null
          created_at?: string
          document_id?: string | null
          floor_no?: number | null
          id?: string
          is_urgent?: boolean
          project_id: string
          published_at?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          building_id?: string | null
          created_at?: string
          document_id?: string | null
          floor_no?: number | null
          id?: string
          is_urgent?: boolean
          project_id?: string
          published_at?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          code: string
          floor_count: number | null
          id: string
          name: string
          project_id: string
        }
        Insert: {
          code: string
          floor_count?: number | null
          id?: string
          name: string
          project_id: string
        }
        Update: {
          code?: string
          floor_count?: number | null
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          body: string
          id: string
          project_id: string
          search_tsv: unknown
          section: string
          title: string
          version: number
        }
        Insert: {
          body: string
          id?: string
          project_id: string
          search_tsv?: unknown
          section: string
          title: string
          version?: number
        }
        Update: {
          body?: string
          id?: string
          project_id?: string
          search_tsv?: unknown
          section?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          calc_method: string
          code: string
          id: string
          name: string
          project_id: string
          unit_price: number | null
        }
        Insert: {
          calc_method?: string
          code: string
          id?: string
          name: string
          project_id: string
          unit_price?: number | null
        }
        Update: {
          calc_method?: string
          code?: string
          id?: string
          name?: string
          project_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          description: string
          fee_type_id: string | null
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount: number
          description: string
          fee_type_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          amount?: number
          description?: string
          fee_type_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string
          id: string
          issued_at: string | null
          paid_amount: number
          period: string
          project_id: string
          qr_payload: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          unit_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          issued_at?: string | null
          paid_amount?: number
          period: string
          project_id: string
          qr_payload?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          unit_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          issued_at?: string | null
          paid_amount?: number
          period?: string
          project_id?: string
          qr_payload?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          curr_index: number
          fee_type_id: string
          id: string
          period: string
          prev_index: number
          recorded_at: string
          recorded_by: string | null
          unit_id: string
        }
        Insert: {
          curr_index: number
          fee_type_id: string
          id?: string
          period: string
          prev_index: number
          recorded_at?: string
          recorded_by?: string | null
          unit_id: string
        }
        Update: {
          curr_index?: number
          fee_type_id?: string
          id?: string
          period?: string
          prev_index?: number
          recorded_at?: string
          recorded_by?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: number
          kind: string
          read_at: string | null
          ref_id: string | null
          sent_zns_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: number
          kind: string
          read_at?: string | null
          ref_id?: string | null
          sent_zns_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: number
          kind?: string
          read_at?: string | null
          ref_id?: string | null
          sent_zns_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_ref: string | null
          id: string
          invoice_id: string | null
          matched_by: string
          method: string
          paid_at: string
          raw_payload: Json | null
          unit_id: string
        }
        Insert: {
          amount: number
          bank_ref?: string | null
          id?: string
          invoice_id?: string | null
          matched_by?: string
          method?: string
          paid_at?: string
          raw_payload?: Json | null
          unit_id: string
        }
        Update: {
          amount?: number
          bank_ref?: string | null
          id?: string
          invoice_id?: string | null
          matched_by?: string
          method?: string
          paid_at?: string
          raw_payload?: Json | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          id_number?: string | null
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      sla_policies: {
        Row: {
          category: string
          escalate_to: Database["public"]["Enums"]["staff_role"]
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          project_id: string
          resolve_mins: number
          respond_mins: number
        }
        Insert: {
          category: string
          escalate_to?: Database["public"]["Enums"]["staff_role"]
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id: string
          resolve_mins: number
          respond_mins: number
        }
        Update: {
          category?: string
          escalate_to?: Database["public"]["Enums"]["staff_role"]
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id?: string
          resolve_mins?: number
          respond_mins?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_assignments: {
        Row: {
          building_id: string | null
          id: string
          is_active: boolean
          project_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          building_id?: string | null
          id?: string
          is_active?: boolean
          project_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          building_id?: string | null
          id?: string
          is_active?: boolean
          project_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_value: string | null
          id: number
          note: string | null
          ticket_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_value?: string | null
          id?: number
          note?: string | null
          ticket_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: number
          note?: string | null
          ticket_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          building_id: string
          category: string
          created_at: string
          description: string | null
          escalated_at: string | null
          id: string
          photo_urls: string[]
          priority: Database["public"]["Enums"]["ticket_priority"]
          project_id: string
          rating: number | null
          rating_note: string | null
          reporter_id: string
          resolved_at: string | null
          responded_at: string | null
          sla_resolve_due: string | null
          sla_respond_due: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          unit_id: string
        }
        Insert: {
          assignee_id?: string | null
          building_id: string
          category: string
          created_at?: string
          description?: string | null
          escalated_at?: string | null
          id?: string
          photo_urls?: string[]
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id: string
          rating?: number | null
          rating_note?: string | null
          reporter_id: string
          resolved_at?: string | null
          responded_at?: string | null
          sla_resolve_due?: string | null
          sla_respond_due?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          unit_id: string
        }
        Update: {
          assignee_id?: string | null
          building_id?: string
          category?: string
          created_at?: string
          description?: string | null
          escalated_at?: string | null
          id?: string
          photo_urls?: string[]
          priority?: Database["public"]["Enums"]["ticket_priority"]
          project_id?: string
          rating?: number | null
          rating_note?: string | null
          reporter_id?: string
          resolved_at?: string | null
          responded_at?: string | null
          sla_resolve_due?: string | null
          sla_respond_due?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_memberships: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          can_view_finance: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["unit_role"]
          status: Database["public"]["Enums"]["member_status"]
          unit_id: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          can_view_finance?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["unit_role"]
          status?: Database["public"]["Enums"]["member_status"]
          unit_id: string
          user_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          can_view_finance?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["unit_role"]
          status?: Database["public"]["Enums"]["member_status"]
          unit_id?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_memberships_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_memberships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_pets: {
        Row: {
          id: string
          name: string | null
          photo_url: string | null
          species: string | null
          unit_id: string
          vaccinated_until: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          photo_url?: string | null
          species?: string | null
          unit_id: string
          vaccinated_until?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          photo_url?: string | null
          species?: string | null
          unit_id?: string
          vaccinated_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_pets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_vehicles: {
        Row: {
          card_no: string | null
          id: string
          plate: string
          unit_id: string
          vehicle_type: string | null
        }
        Insert: {
          card_no?: string | null
          id?: string
          plate: string
          unit_id: string
          vehicle_type?: string | null
        }
        Update: {
          card_no?: string | null
          id?: string
          plate?: string
          unit_id?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_vehicles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area_m2: number | null
          building_id: string
          code: string
          created_at: string
          floor_no: number
          id: string
          kind: Database["public"]["Enums"]["unit_kind"]
          state: Database["public"]["Enums"]["unit_state"]
        }
        Insert: {
          area_m2?: number | null
          building_id: string
          code: string
          created_at?: string
          floor_no: number
          id?: string
          kind?: Database["public"]["Enums"]["unit_kind"]
          state?: Database["public"]["Enums"]["unit_state"]
        }
        Update: {
          area_m2?: number | null
          building_id?: string
          code?: string
          created_at?: string
          floor_no?: number
          id?: string
          kind?: Database["public"]["Enums"]["unit_kind"]
          state?: Database["public"]["Enums"]["unit_state"]
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      building_project: { Args: { p_building: string }; Returns: string }
      can_see_profile: { Args: { p_user: string }; Returns: boolean }
      create_ticket: {
        Args: {
          p_category: string
          p_description?: string
          p_photo_urls?: string[]
          p_priority: Database["public"]["Enums"]["ticket_priority"]
          p_title: string
          p_unit: string
        }
        Returns: string
      }
      current_unit_ids: { Args: never; Returns: string[] }
      escalate_overdue_tickets: { Args: never; Returns: undefined }
      expire_memberships: { Args: never; Returns: undefined }
      generate_invoices: {
        Args: { p_period: string; p_project: string }
        Returns: number
      }
      is_staff: { Args: { p_project: string }; Returns: boolean }
      is_unit_manager: { Args: { p_unit: string }; Returns: boolean }
      rate_ticket: {
        Args: { p_note?: string; p_rating: number; p_ticket: string }
        Returns: undefined
      }
      unit_project: { Args: { p_unit: string }; Returns: string }
    }
    Enums: {
      invoice_status: "draft" | "issued" | "partial" | "paid" | "void"
      member_status: "pending" | "active" | "revoked" | "expired"
      staff_role:
        | "bql_manager"
        | "bql_staff"
        | "technician"
        | "security"
        | "bqt"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "new"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "closed"
        | "rejected"
      unit_kind: "apartment" | "shophouse" | "office" | "penthouse"
      unit_role: "owner" | "authorized" | "tenant" | "family"
      unit_state: "vacant" | "owner_occupied" | "rented"
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
      invoice_status: ["draft", "issued", "partial", "paid", "void"],
      member_status: ["pending", "active", "revoked", "expired"],
      staff_role: ["bql_manager", "bql_staff", "technician", "security", "bqt"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "new",
        "assigned",
        "in_progress",
        "resolved",
        "closed",
        "rejected",
      ],
      unit_kind: ["apartment", "shophouse", "office", "penthouse"],
      unit_role: ["owner", "authorized", "tenant", "family"],
      unit_state: ["vacant", "owner_occupied", "rented"],
    },
  },
} as const
