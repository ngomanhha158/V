// Kiểu của schema, khớp với schema.sql.
//
// Trước đây sinh tự động bằng `db gen types`. Hệ thống không còn chạy
// trên Supabase nên không còn lệnh đó: sửa schema.sql thì sửa tay ở đây, rồi
// chạy `npx tsc --noEmit`. Tẻ nhạt, nhưng cái mất là một lệnh tiện tay, còn
// cái được là không còn phải trả tiền cho một nhà cung cấp để có kiểu dữ liệu.
//
// MỘT chỗ sửa tay, phải giữ lại sau mỗi lần sinh lại: bộ sinh khai mọi cột của
// `returns table` là non-null, kể cả cột chắc chắn null được — avg/percentile
// trên tập rỗng, hay hàm trả null tường minh. Tin nó thì `x.toFixed()` qua được
// TypeScript rồi nổ trên trình duyệt của người dùng. Các cột đó được đánh
// `| null` bằng tay ở đây; xem `bql_debt_report`, `bql_dashboard`.

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
      maintenance_plans: {
        Row: {
          bat_buoc_phap_ly: boolean
          building_id: string | null
          chu_ky_ngay: number
          created_at: string
          ghi_chu: string | null
          han_ke_tiep: string
          hang_muc: string
          id: string
          is_active: boolean
          nha_thau: string | null
          nhac_truoc_ngay: number
          project_id: string
          ten: string
        }
        Insert: {
          bat_buoc_phap_ly?: boolean
          building_id?: string | null
          chu_ky_ngay: number
          created_at?: string
          ghi_chu?: string | null
          han_ke_tiep: string
          hang_muc: string
          id?: string
          is_active?: boolean
          nha_thau?: string | null
          nhac_truoc_ngay?: number
          project_id: string
          ten: string
        }
        Update: {
          bat_buoc_phap_ly?: boolean
          building_id?: string | null
          chu_ky_ngay?: number
          created_at?: string
          ghi_chu?: string | null
          han_ke_tiep?: string
          hang_muc?: string
          id?: string
          is_active?: boolean
          nha_thau?: string | null
          nhac_truoc_ngay?: number
          project_id?: string
          ten?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_runs: {
        Row: {
          han: string
          id: string
          ket_qua: string | null
          lam_luc: string | null
          mo_luc: string
          nguoi_lam: string | null
          plan_id: string
        }
        Insert: {
          han: string
          id?: string
          ket_qua?: string | null
          lam_luc?: string | null
          mo_luc?: string
          nguoi_lam?: string | null
          plan_id: string
        }
        Update: {
          han?: string
          id?: string
          ket_qua?: string | null
          lam_luc?: string | null
          mo_luc?: string
          nguoi_lam?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_runs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_comments: {
        Row: {
          an_boi: string | null
          an_luc: string | null
          an_ly_do: string | null
          announcement_id: string
          author_id: string
          body: string
          created_at: string
          id: number
          unit_id: string | null
        }
        Insert: {
          an_boi?: string | null
          an_luc?: string | null
          an_ly_do?: string | null
          announcement_id: string
          author_id: string
          body: string
          created_at?: string
          id?: number
          unit_id?: string | null
        }
        Update: {
          an_boi?: string | null
          an_luc?: string | null
          an_ly_do?: string | null
          announcement_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_polls: {
        Row: {
          announcement_id: string
          cau_hoi: string
          created_at: string
          dong_luc: string | null
          kin: boolean
          lua_chon: string[]
        }
        Insert: {
          announcement_id: string
          cau_hoi: string
          created_at?: string
          dong_luc?: string | null
          kin?: boolean
          lua_chon: string[]
        }
        Update: {
          announcement_id?: string
          cau_hoi?: string
          created_at?: string
          dong_luc?: string | null
          kin?: boolean
          lua_chon?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "announcement_polls_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: true
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_votes: {
        Row: {
          bo_luc: string
          chon: number
          poll_id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          bo_luc?: string
          chon: number
          poll_id: string
          unit_id: string
          user_id: string
        }
        Update: {
          bo_luc?: string
          chon?: number
          poll_id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "announcement_polls"
            referencedColumns: ["announcement_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_id: string | null
          actor_role: string
          at: string
          ban_ghi: string
          bang: string
          id: number
          project_id: string | null
          sau: Json
          thao_tac: string
          truoc: Json
        }
        Insert: {
          actor_id?: string | null
          actor_role: string
          at?: string
          ban_ghi: string
          bang: string
          id?: number
          project_id?: string | null
          sau?: Json
          thao_tac: string
          truoc?: Json
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          at?: string
          ban_ghi?: string
          bang?: string
          id?: number
          project_id?: string | null
          sau?: Json
          thao_tac?: string
          truoc?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_transactions: {
        Row: {
          account_number: string | null
          amount: number
          bank_ref: string | null
          cach_khop: string | null
          con_du: number
          content: string
          ghi_chu: string | null
          id: string
          paid_at: string
          project_id: string
          provider: string
          provider_ref: string
          raw_payload: Json
          received_at: string
          trang_thai: string
          unit_id: string | null
        }
        Insert: {
          account_number?: string | null
          amount: number
          bank_ref?: string | null
          cach_khop?: string | null
          con_du?: number
          content?: string
          ghi_chu?: string | null
          id?: string
          paid_at: string
          project_id: string
          provider: string
          provider_ref: string
          raw_payload?: Json
          received_at?: string
          trang_thai?: string
          unit_id?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          bank_ref?: string | null
          cach_khop?: string | null
          con_du?: number
          content?: string
          ghi_chu?: string | null
          id?: string
          paid_at?: string
          project_id?: string
          provider?: string
          provider_ref?: string
          raw_payload?: Json
          received_at?: string
          trang_thai?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_unit_id_fkey"
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
          loai_xe: Database["public"]["Enums"]["loai_xe"] | null
          calc_method: string
          code: string
          id: string
          name: string
          project_id: string
          unit_price: number | null
        }
        Insert: {
          loai_xe?: Database["public"]["Enums"]["loai_xe"] | null
          calc_method?: string
          code: string
          id?: string
          name: string
          project_id: string
          unit_price?: number | null
        }
        Update: {
          loai_xe?: Database["public"]["Enums"]["loai_xe"] | null
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
          bank_txn_id: string | null
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
          bank_txn_id?: string | null
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
          bank_txn_id?: string | null
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
      quy_bao_tri: {
        Row: {
          project_id: string
          ngan_hang: string
          so_tai_khoan: string
          so_du_ngan_hang: number | null
          doi_chieu_ngay: string | null
          cap_nhat_luc: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      quy_bao_tri_giao_dich: {
        Row: {
          id: string
          project_id: string
          loai: string
          ngay: string
          dien_giai: string
          so_tien: number
          nghi_quyet: string | null
          ngay_nq: string | null
          ghi_chu: string | null
          dao_cua: string | null
          ghi_luc: string
          ghi_boi: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      phieu_thu: {
        Row: {
          id: string
          project_id: string
          so_phieu: string
          ky: string
          stt: number
          unit_id: string
          nguoi_nop: string
          ma_can: string
          tong_thu: number
          hinh_thuc: string
          bank_txn_id: string | null
          nhan_luc: string
          lap_luc: string
          lap_boi: string | null
          huy_luc: string | null
          huy_boi: string | null
          ly_do_huy: string | null
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: "phieu_thu_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phieu_thu_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      phieu_thu_dong: {
        Row: {
          id: string
          phieu_id: string
          thu_tu: number
          loai: string
          dien_giai: string
          so_tien: number
          invoice_id: string | null
          payment_id: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      bai_xe: {
        Row: {
          building_id: string
          ghi_chu: string | null
          loai: Database["public"]["Enums"]["loai_xe"]
          moi_can: number
          tong_cho: number
        }
        Insert: {
          building_id: string
          ghi_chu?: string | null
          loai: Database["public"]["Enums"]["loai_xe"]
          moi_can: number
          tong_cho: number
        }
        Update: {
          building_id?: string
          ghi_chu?: string | null
          loai?: Database["public"]["Enums"]["loai_xe"]
          moi_can?: number
          tong_cho?: number
        }
        Relationships: []
      }
      unit_vehicles: {
        Row: {
          card_no: string | null
          dang_ky_luc: string
          id: string
          loai: Database["public"]["Enums"]["loai_xe"] | null
          plate: string
          trang_thai: string
          unit_id: string
          vehicle_type: string | null
        }
        Insert: {
          card_no?: string | null
          dang_ky_luc?: string
          id?: string
          loai?: Database["public"]["Enums"]["loai_xe"] | null
          plate: string
          trang_thai?: string
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
      // ── Lớp đăng nhập tự viết (railway/03_auth.sql) ──
      // Thêm tay, không sinh máy: chỉ service_role gọi được, mà công cụ sinh
      // kiểu thì chạy dưới quyền khác nên không nhìn thấy chúng.
      auth_tim: { Args: { p_danh_tinh: string }; Returns: string | null }
      auth_gui_ma: {
        Args: { p_danh_tinh: string; p_ma: string }
        Returns: { trang_thai: string; cho_giay: number }[]
      }
      auth_kiem_ma: {
        Args: { p_danh_tinh: string; p_ma: string }
        Returns: { trang_thai: string; uid: string | null }[]
      }
      auth_kiem_mat_khau: {
        Args: { p_danh_tinh: string; p_mat_khau: string }
        Returns: string | null
      }
      auth_tao_nguoi_dung: {
        Args: { p_email: string; p_ho_ten: string; p_mat_khau: string; p_phone: string }
        Returns: string
      }
      auth_dat_mat_khau: { Args: { p_mat_khau: string; p_uid: string }; Returns: boolean }
      auth_xoa_nguoi_dung: { Args: { p_uid: string }; Returns: boolean }
      auth_huy_ma: { Args: { p_danh_tinh: string }; Returns: boolean }
      auth_don_ma: { Args: never; Returns: number }
      dang_ky_xe: {
        Args: {
          p_bien_so: string
          p_loai: Database["public"]["Enums"]["loai_xe"]
          p_the?: string | null
          p_unit: string
        }
        Returns: { trang_thai: string; vi_tri: number }[]
      }
      duyet_xe_tiep: {
        Args: { p_building: string; p_loai: Database["public"]["Enums"]["loai_xe"] }
        Returns: { bien_so: string; can: string }[]
      }
      is_bqt: { Args: { p_project: string }; Returns: boolean }
      o_trong_du_an: { Args: { p_project: string }; Returns: boolean }
      quy_ghi_duoc: { Args: { p_project: string }; Returns: boolean }
      quy_ghi: {
        Args: {
          p_project: string
          p_loai: string
          p_ngay: string
          p_dien_giai: string
          p_so_tien: number
          p_nghi_quyet?: string | null
          p_ngay_nq?: string | null
          p_ghi_chu?: string | null
        }
        Returns: string
      }
      quy_dao: { Args: { p_gd: string; p_ly_do: string }; Returns: string }
      quy_dat_doi_chieu: {
        Args: {
          p_project: string
          p_ngan_hang: string
          p_so_tk: string
          p_so_du: number
          p_ngay: string
        }
        Returns: undefined
      }
      quy_so_ke_toan: {
        Args: { p_project: string }
        Returns: {
          id: string
          loai: string
          ngay: string
          dien_giai: string
          so_tien: number
          nghi_quyet: string | null
          ngay_nq: string | null
          ghi_chu: string | null
          da_dao: boolean
          la_dong_dao: boolean
          luy_ke: number
        }[]
      }
      huy_phieu_thu: {
        Args: { p_phieu: string; p_ly_do: string }
        Returns: Json
      }
      kiem_lien_tuc_phieu_thu: {
        Args: { p_project: string; p_ky: string }
        Returns: { thieu_stt: number }[]
      }
      bql_so_phieu_thu: {
        Args: { p_project: string; p_ky: string }
        Returns: {
          id: string
          so_phieu: string
          stt: number
          nhan_luc: string
          lap_luc: string
          ma_can: string
          nguoi_nop: string
          tong_thu: number
          da_huy: boolean
          ly_do_huy: string | null
        }[]
      }
      dat_han_muc_bai_xe: {
        Args: {
          p_building: string
          p_ghi_chu?: string | null
          p_loai: Database["public"]["Enums"]["loai_xe"]
          p_moi_can: number
          p_tong_cho: number
        }
        Returns: number
      }
      cho_do_cua_can: {
        Args: { p_unit: string }
        Returns: {
          loai: Database["public"]["Enums"]["loai_xe"]
          da_dung: number
          moi_can: number
          co_han_muc: boolean
          tong_cho: number
          ca_toa_dang_dung: number
          toi_dang_cho: number
          vi_tri_dau: number
          hang_cho_ca_toa: number
          toi_qua_han_muc: number
        }[]
      }
      bai_xe_tong_quan: {
        Args: { p_project: string }
        Returns: {
          building_id: string
          toa: string
          loai: Database["public"]["Enums"]["loai_xe"]
          co_han_muc: boolean
          tong_cho: number
          moi_can: number
          dang_dung: number
          hang_cho: number
          qua_han_muc: number
        }[]
      }
      kiem_the: {
        Args: { p_uid: string; p_unit: string }
        Returns: {
          ho_ten: string | null
          anh: string | null
          can: string
          toa: string
          vai_tro: Database["public"]["Enums"]["unit_role"] | null
          con_hieu_luc: boolean
          ly_do: string
        }[]
      }

      bql_gan_nhan_su: {
        Args: {
          p_project: string
          p_role: Database["public"]["Enums"]["staff_role"]
          p_user: string
        }
        Returns: undefined
      }
      bql_generate_invoices: {
        Args: { p_period: string; p_project: string }
        Returns: number
      }
      bql_issue_invoices: {
        Args: { p_period: string; p_project: string }
        Returns: number
      }
      bql_bo_qua_giao_dich: {
        Args: { p_ghi_chu: string; p_txn: string }
        Returns: undefined
      }
      bql_doi_soat: {
        Args: { p_project: string; p_trang_thai?: string }
        Returns: {
          amount: number
          bank_ref: string | null
          cach_khop: string | null
          con_du: number
          content: string
          // Chỉ tính cho giao dịch chưa khớp -> null ở các dòng còn lại.
          goi_y: string[] | null
          ghi_chu: string | null
          id: string
          paid_at: string
          provider: string
          trang_thai: string
          // null khi chưa gạch vào căn nào.
          unit_code: string | null
        }[]
      }
      bql_gan_chu_ho_dau_tien: {
        Args: { p_unit: string; p_user: string }
        Returns: undefined
      }
      bql_gan_giao_dich: {
        Args: { p_txn: string; p_unit: string }
        Returns: Json
      }
      ghi_nhan_tien_ve: {
        Args: {
          p_account?: string | null
          p_amount: number
          p_bank_ref?: string | null
          p_content: string
          p_paid_at: string
          p_project: string
          p_provider: string
          p_provider_ref: string
          p_raw?: Json
        }
        Returns: Json
      }
      bql_cho_duyet_chu_ho: {
        Args: { p_project: string }
        Returns: {
          building_code: string
          // profiles.phone/email null được: cư dân đăng nhập bằng email thì
          // chưa chắc đã có SĐT, và ngược lại.
          dien_thoai: string | null
          email: string | null
          ho_ten: string
          membership_id: string
          unit_code: string
          unit_id: string
          xin_luc: string
        }[]
      }
      bql_duyet_chu_ho_dau_tien: {
        Args: { p_membership: string }
        Returns: Json
      }
      bql_ngung_nhan_su: {
        Args: {
          p_project: string
          p_role: Database["public"]["Enums"]["staff_role"]
          p_user: string
        }
        Returns: undefined
      }
      bql_san_sang_go_live: {
        Args: { p_project: string }
        Returns: {
          so_bieu_phi: number
          so_can: number
          so_can_co_chu: number
          so_cho_duyet: number
          so_hoa_don_da_phat: number
          so_hoa_don_ky_nay: number
          so_nhan_su: number
          so_noi_quy: number
          so_sla: number
          so_toa: number
        }[]
      }
      bql_debt_report: {
        Args: { p_project: string }
        Returns: {
          building_code: string
          con_no: number
          dien_thoai: string | null
          han_cu_nhat: string
          so_hoa_don: number
          so_ngay_qua_han: number
          ten_lien_he: string | null
          unit_code: string
          unit_id: string
        }[]
      }
      bql_danh_sach_nguoi_dung: {
        Args: { p_project: string }
        Returns: {
          can_ho: string[]
          email: string
          ho_ten: string
          phone: string
          tao_luc: string
          user_id: string
          vai_tro_bql: string[]
        }[]
      }
      bql_dashboard: {
        Args: { p_den?: string; p_project: string; p_tu?: string }
        Returns: {
          cong_no: number
          cong_no_qua_han: number
          da_thu_ky: number
          dang_mo_hien_tai: number
          den_ngay: string
          // Null khi kỳ chưa có yêu cầu nào ngã ngũ / xong / được chấm điểm.
          diem_hai_long: number | null
          gio_phan_hoi_trung_vi: number | null
          gio_xu_ly_p90: number | null
          gio_xu_ly_trung_binh: number | null
          gio_xu_ly_trung_vi: number | null
          phai_thu_ky: number
          qua_han_hien_tai: number
          so_can_no: number
          so_luot_danh_gia: number
          ticket_chua_ket_luan: number
          ticket_co_ket_luan: number
          ticket_dung_sla: number
          ticket_khong_co_sla: number
          ticket_tu_choi: number
          tien_ve_ky: number
          tong_ticket: number
          tu_ngay: string
          ty_le_danh_gia: number | null
          ty_le_dung_sla: number | null
        }[]
      }
      bql_dashboard_thang: {
        Args: { p_project: string; p_so_thang?: number }
        Returns: {
          da_thu: number
          gio_xu_ly_trung_vi: number | null
          phai_thu: number
          thang: string
          ticket_co_ket_luan: number
          ticket_dung_sla: number
          ticket_moi: number
          tien_ve: number
          ty_le_dung_sla: number | null
        }[]
      }
      building_project: { Args: { p_building: string }; Returns: string }
      mark_notifications_read: {
        Args: { p_ids?: number[] }
        Returns: number
      }
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
      remind_unpaid_invoices: { Args: never; Returns: number }
      expire_memberships: { Args: never; Returns: undefined }
      generate_invoices: {
        Args: { p_period: string; p_project: string }
        Returns: number
      }
      xong_bao_tri: {
        Args: { p_ket_qua?: string; p_run: string }
        Returns: string
      }
      mo_ky_bao_tri: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      bo_phieu: {
        Args: { p_chon: number; p_poll: string; p_unit: string }
        Returns: undefined
      }
      ket_qua_tham_do: {
        Args: { p_poll: string }
        Returns: { chon: number; so_phieu: number }[]
      }
      is_bql_manager: { Args: { p_project: string }; Returns: boolean }
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
      loai_xe: "o_to" | "xe_may" | "xe_dap" | "khac"
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
      loai_xe: ["o_to", "xe_may", "xe_dap", "khac"],
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
