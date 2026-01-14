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
      article_reports: {
        Row: {
          admin_notes: string | null
          article_id: string
          created_at: string
          description: string
          id: string
          report_type: string
          reporter_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          article_id: string
          created_at?: string
          description: string
          id?: string
          report_type: string
          reporter_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          article_id?: string
          created_at?: string
          description?: string
          id?: string
          report_type?: string
          reporter_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_reports_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_premium: boolean
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contractor_entitlements: {
        Row: {
          activated_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_recurring: boolean | null
          is_stackable: boolean | null
          job_allowance: number | null
          jobs_used: number | null
          plan_type: string
          purchased_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_recurring?: boolean | null
          is_stackable?: boolean | null
          job_allowance?: number | null
          jobs_used?: number | null
          plan_type: string
          purchased_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_recurring?: boolean | null
          is_stackable?: boolean | null
          job_allowance?: number | null
          jobs_used?: number | null
          plan_type?: string
          purchased_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contractor_packages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          jobs_per_week: number
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          jobs_per_week: number
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          jobs_per_week?: number
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      contractor_profiles: {
        Row: {
          city: string | null
          company_description: string | null
          company_name: string
          country: string | null
          created_at: string
          id: string
          industry: string | null
          is_entrepreneur: boolean | null
          is_verified: boolean | null
          phone: string | null
          suburb: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          city?: string | null
          company_description?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          is_entrepreneur?: boolean | null
          is_verified?: boolean | null
          phone?: string | null
          suburb?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          city?: string | null
          company_description?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          is_entrepreneur?: boolean | null
          is_verified?: boolean | null
          phone?: string | null
          suburb?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      contractor_subscriptions: {
        Row: {
          contractor_profile_id: string
          created_at: string
          ends_at: string | null
          id: string
          jobs_posted_this_week: number | null
          package_id: string
          starts_at: string
          status: string
          updated_at: string
          week_start_date: string
        }
        Insert: {
          contractor_profile_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          jobs_posted_this_week?: number | null
          package_id: string
          starts_at?: string
          status?: string
          updated_at?: string
          week_start_date?: string
        }
        Update: {
          contractor_profile_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          jobs_posted_this_week?: number | null
          package_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_subscriptions_contractor_profile_id_fkey"
            columns: ["contractor_profile_id"]
            isOneToOne: false
            referencedRelation: "contractor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "contractor_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_read_status: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_read_status_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          activity_started_at: string | null
          contractor_user_id: string
          created_at: string
          employee_user_id: string
          id: string
          job_application_id: string | null
          last_activity_at: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activity_started_at?: string | null
          contractor_user_id: string
          created_at?: string
          employee_user_id: string
          id?: string
          job_application_id?: string | null
          last_activity_at?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activity_started_at?: string | null
          contractor_user_id?: string
          created_at?: string
          employee_user_id?: string
          id?: string
          job_application_id?: string | null
          last_activity_at?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          availability: string | null
          bio: string | null
          city: string | null
          comfortable_heavy_lifting: boolean | null
          comfortable_standing: boolean | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          experience_years: number | null
          has_car: boolean | null
          has_ird_number: boolean | null
          headline: string | null
          id: string
          industry: string | null
          ird_number: string | null
          is_available: boolean | null
          languages: string[] | null
          last_application_at: string | null
          location_region: string | null
          phone: string | null
          skills: string[] | null
          suburb: string | null
          updated_at: string
          user_id: string
          visa_status: string | null
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          city?: string | null
          comfortable_heavy_lifting?: boolean | null
          comfortable_standing?: boolean | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          experience_years?: number | null
          has_car?: boolean | null
          has_ird_number?: boolean | null
          headline?: string | null
          id?: string
          industry?: string | null
          ird_number?: string | null
          is_available?: boolean | null
          languages?: string[] | null
          last_application_at?: string | null
          location_region?: string | null
          phone?: string | null
          skills?: string[] | null
          suburb?: string | null
          updated_at?: string
          user_id: string
          visa_status?: string | null
        }
        Update: {
          availability?: string | null
          bio?: string | null
          city?: string | null
          comfortable_heavy_lifting?: boolean | null
          comfortable_standing?: boolean | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          experience_years?: number | null
          has_car?: boolean | null
          has_ird_number?: boolean | null
          headline?: string | null
          id?: string
          industry?: string | null
          ird_number?: string | null
          is_available?: boolean | null
          languages?: string[] | null
          last_application_at?: string | null
          location_region?: string | null
          phone?: string | null
          skills?: string[] | null
          suburb?: string | null
          updated_at?: string
          user_id?: string
          visa_status?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          employee_id: string
          id: string
          job_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          employee_id: string
          id?: string
          job_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          job_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_shifts: {
        Row: {
          break_minutes: number | null
          break_paid: boolean | null
          created_at: string
          end_time: string
          id: string
          job_id: string
          shift_date: string
          start_time: string
        }
        Insert: {
          break_minutes?: number | null
          break_paid?: boolean | null
          created_at?: string
          end_time: string
          id?: string
          job_id: string
          shift_date: string
          start_time: string
        }
        Update: {
          break_minutes?: number | null
          break_paid?: boolean | null
          created_at?: string
          end_time?: string
          id?: string
          job_id?: string
          shift_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_shifts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_work_dates: {
        Row: {
          created_at: string
          id: string
          job_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_work_dates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          contractor_id: string
          created_at: string
          description: string
          duration: string | null
          ends_at: string | null
          experience_required: boolean | null
          form_data: Json | null
          hourly_rate_max: number | null
          hourly_rate_min: number | null
          id: string
          industry: string | null
          is_sse: boolean | null
          job_type: string
          location_city: string | null
          location_country: string | null
          location_suburb: string | null
          positions_available: number
          positions_filled: number
          provides_accommodation: boolean | null
          provides_training: boolean | null
          requirements: string | null
          requires_car: boolean | null
          requires_heavy_lifting: boolean | null
          requires_standing: boolean | null
          schedule_type: string | null
          skills_required: string[] | null
          starts_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          wizard_step: number | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          description: string
          duration?: string | null
          ends_at?: string | null
          experience_required?: boolean | null
          form_data?: Json | null
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          industry?: string | null
          is_sse?: boolean | null
          job_type?: string
          location_city?: string | null
          location_country?: string | null
          location_suburb?: string | null
          positions_available?: number
          positions_filled?: number
          provides_accommodation?: boolean | null
          provides_training?: boolean | null
          requirements?: string | null
          requires_car?: boolean | null
          requires_heavy_lifting?: boolean | null
          requires_standing?: boolean | null
          schedule_type?: string | null
          skills_required?: string[] | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          wizard_step?: number | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          description?: string
          duration?: string | null
          ends_at?: string | null
          experience_required?: boolean | null
          form_data?: Json | null
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          industry?: string | null
          is_sse?: boolean | null
          job_type?: string
          location_city?: string | null
          location_country?: string | null
          location_suburb?: string | null
          positions_available?: number
          positions_filled?: number
          provides_accommodation?: boolean | null
          provides_training?: boolean | null
          requirements?: string | null
          requires_car?: boolean | null
          requires_heavy_lifting?: boolean | null
          requires_standing?: boolean | null
          schedule_type?: string | null
          skills_required?: string[] | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          wizard_step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_products: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          interval: string | null
          plan_id: string
          plan_name: string
          plan_type: string
          price_cents: number
          stripe_price_id: string | null
          stripe_product_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string | null
          plan_id: string
          plan_name: string
          plan_type: string
          price_cents: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string | null
          plan_id?: string
          plan_name?: string
          plan_type?: string
          price_cents?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          two_factor_backup_codes: string[] | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          two_factor_backup_codes?: string[] | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          two_factor_backup_codes?: string[] | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          plan_name: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      contractor_has_published_jobs: {
        Args: { _contractor_profile_id: string }
        Returns: boolean
      }
      get_unread_message_count: { Args: { _user_id: string }; Returns: number }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "contractor" | "employee" | "writer"
      job_status: "draft" | "published" | "closed" | "filled"
      subscription_status: "active" | "cancelled" | "expired" | "pending"
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
      app_role: ["admin", "contractor", "employee", "writer"],
      job_status: ["draft", "published", "closed", "filled"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
    },
  },
} as const
