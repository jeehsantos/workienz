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
      application_pre_employment_packs: {
        Row: {
          answers: Json | null
          conversation_id: string | null
          created_at: string
          id: string
          job_application_id: string
          pack_version: string
          required_by_user_id: string
          reviewed_at: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          job_application_id: string
          pack_version?: string
          required_by_user_id: string
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          job_application_id?: string
          pack_version?: string
          required_by_user_id?: string
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_pre_employment_packs_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: true
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      article_chunks: {
        Row: {
          article_id: string
          chunk_index: number
          chunk_text: string
          embedding: string | null
          id: string
          search_vector: unknown
          token_count: number | null
          updated_at: string
        }
        Insert: {
          article_id: string
          chunk_index: number
          chunk_text: string
          embedding?: string | null
          id?: string
          search_vector?: unknown
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          article_id?: string
          chunk_index?: number
          chunk_text?: string
          embedding?: string | null
          id?: string
          search_vector?: unknown
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_chunks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          article_type: string | null
          author_id: string
          canonical_text: string | null
          category: string | null
          content: string
          content_blocks: Json | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_premium: boolean
          is_published: boolean
          journey_id: string | null
          slug: string
          summary: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_stage: string | null
          visa_type: string | null
        }
        Insert: {
          article_type?: string | null
          author_id: string
          canonical_text?: string | null
          category?: string | null
          content: string
          content_blocks?: Json | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          journey_id?: string | null
          slug: string
          summary?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_stage?: string | null
          visa_type?: string | null
        }
        Update: {
          article_type?: string | null
          author_id?: string
          canonical_text?: string | null
          category?: string | null
          content?: string
          content_blocks?: Json | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          journey_id?: string | null
          slug?: string
          summary?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_stage?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topic_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_ai_usage_ledger: {
        Row: {
          contractor_user_id: string
          count: number
          created_at: string
          event_type: string
          id: string
          job_id: string
        }
        Insert: {
          contractor_user_id: string
          count?: number
          created_at?: string
          event_type: string
          id?: string
          job_id: string
        }
        Update: {
          contractor_user_id?: string
          count?: number
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string
        }
        Relationships: []
      }
      contractor_application_notes: {
        Row: {
          application_id: string
          contractor_user_id: string
          created_at: string
          id: string
          note: string
          updated_at: string
        }
        Insert: {
          application_id: string
          contractor_user_id: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          contractor_user_id?: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      contractor_entitlements: {
        Row: {
          activated_at: string | null
          created_at: string | null
          credit_applied_to_entitlement_id: string | null
          deactivated_at: string | null
          deactivated_reason: string | null
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
          credit_applied_to_entitlement_id?: string | null
          deactivated_at?: string | null
          deactivated_reason?: string | null
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
          credit_applied_to_entitlement_id?: string | null
          deactivated_at?: string | null
          deactivated_reason?: string | null
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
        Relationships: [
          {
            foreignKeyName: "fk_credit_applied_to_entitlement"
            columns: ["credit_applied_to_entitlement_id"]
            isOneToOne: false
            referencedRelation: "contractor_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_favorite_workers: {
        Row: {
          contractor_user_id: string
          created_at: string
          employee_profile_id: string
          employee_user_id: string
          id: string
          job_id: string | null
          note: string | null
          updated_at: string
        }
        Insert: {
          contractor_user_id: string
          created_at?: string
          employee_profile_id: string
          employee_user_id: string
          id?: string
          job_id?: string | null
          note?: string | null
          updated_at?: string
        }
        Update: {
          contractor_user_id?: string
          created_at?: string
          employee_profile_id?: string
          employee_user_id?: string
          id?: string
          job_id?: string | null
          note?: string | null
          updated_at?: string
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
          avatar_url: string | null
          city: string | null
          company_description: string | null
          company_name: string
          country: string | null
          created_at: string
          has_priority: boolean
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
          avatar_url?: string | null
          city?: string | null
          company_description?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          has_priority?: boolean
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
          avatar_url?: string | null
          city?: string | null
          company_description?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          has_priority?: boolean
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
      contractor_referral_codes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          referral_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contractor_referral_rewards: {
        Row: {
          created_at: string
          days_granted: number
          entitlement_id: string | null
          granted_at: string
          id: string
          job_post_id: string
          referral_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          days_granted: number
          entitlement_id?: string | null
          granted_at?: string
          id?: string
          job_post_id: string
          referral_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          days_granted?: number
          entitlement_id?: string | null
          granted_at?: string
          id?: string
          job_post_id?: string
          referral_id?: string
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_referral_rewards_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "contractor_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "contractor_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_referrals: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          qualified_at: string | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          status: string
          updated_at: string
          user_agent: string | null
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown
          qualified_at?: string | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          qualified_at?: string | null
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          voided_at?: string | null
          voided_reason?: string | null
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
          hired_at: string | null
          id: string
          job_application_id: string | null
          last_activity_at: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          scheduled_deletion_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activity_started_at?: string | null
          contractor_user_id: string
          created_at?: string
          employee_user_id: string
          hired_at?: string | null
          id?: string
          job_application_id?: string | null
          last_activity_at?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          scheduled_deletion_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activity_started_at?: string | null
          contractor_user_id?: string
          created_at?: string
          employee_user_id?: string
          hired_at?: string | null
          id?: string
          job_application_id?: string | null
          last_activity_at?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          scheduled_deletion_at?: string | null
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
          cv_references: Json | null
          date_of_birth: string | null
          education: Json | null
          enable_formal_cv: boolean | null
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
          work_experience: Json | null
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          city?: string | null
          comfortable_heavy_lifting?: boolean | null
          comfortable_standing?: boolean | null
          country?: string | null
          created_at?: string
          cv_references?: Json | null
          date_of_birth?: string | null
          education?: Json | null
          enable_formal_cv?: boolean | null
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
          work_experience?: Json | null
        }
        Update: {
          availability?: string | null
          bio?: string | null
          city?: string | null
          comfortable_heavy_lifting?: boolean | null
          comfortable_standing?: boolean | null
          country?: string | null
          created_at?: string
          cv_references?: Json | null
          date_of_birth?: string | null
          education?: Json | null
          enable_formal_cv?: boolean | null
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
          work_experience?: Json | null
        }
        Relationships: []
      }
      employee_referral_credits: {
        Row: {
          bonus_credits_balance: number
          bonus_credits_used: number
          created_at: string
          has_premium_article_access: boolean
          id: string
          is_shadow_banned: boolean
          referral_code: string
          shadow_banned_at: string | null
          shadow_banned_reason: string | null
          total_verified_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_credits_balance?: number
          bonus_credits_used?: number
          created_at?: string
          has_premium_article_access?: boolean
          id?: string
          is_shadow_banned?: boolean
          referral_code: string
          shadow_banned_at?: string | null
          shadow_banned_reason?: string | null
          total_verified_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_credits_balance?: number
          bonus_credits_used?: number
          created_at?: string
          has_premium_article_access?: boolean
          id?: string
          is_shadow_banned?: boolean
          referral_code?: string
          shadow_banned_at?: string | null
          shadow_banned_reason?: string | null
          total_verified_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_ai_questionnaires: {
        Row: {
          generated_at: string
          job_id: string
          model: string
          prompt_version: string
          questionnaire: Json
        }
        Insert: {
          generated_at?: string
          job_id: string
          model: string
          prompt_version?: string
          questionnaire: Json
        }
        Update: {
          generated_at?: string
          job_id?: string
          model?: string
          prompt_version?: string
          questionnaire?: Json
        }
        Relationships: [
          {
            foreignKeyName: "job_ai_questionnaires_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          ai_reason_summary: string | null
          ai_score: number | null
          ai_score_updated_at: string | null
          ai_scoring_status: string
          application_answers: Json | null
          cover_letter: string | null
          created_at: string
          employee_id: string
          id: string
          job_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_reason_summary?: string | null
          ai_score?: number | null
          ai_score_updated_at?: string | null
          ai_scoring_status?: string
          application_answers?: Json | null
          cover_letter?: string | null
          created_at?: string
          employee_id: string
          id?: string
          job_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_reason_summary?: string | null
          ai_score?: number | null
          ai_score_updated_at?: string | null
          ai_scoring_status?: string
          application_answers?: Json | null
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
      job_deletion_tracking: {
        Row: {
          contractor_user_id: string
          custom_reason: string | null
          deleted_at: string
          deletion_reason: string
          id: string
          job_id: string
          job_title: string
        }
        Insert: {
          contractor_user_id: string
          custom_reason?: string | null
          deleted_at?: string
          deletion_reason: string
          id?: string
          job_id: string
          job_title: string
        }
        Update: {
          contractor_user_id?: string
          custom_reason?: string | null
          deleted_at?: string
          deletion_reason?: string
          id?: string
          job_id?: string
          job_title?: string
        }
        Relationships: []
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
      job_top_candidates: {
        Row: {
          id: string
          job_application_id: string
          job_id: string
          rank: number
          score: number
          updated_at: string
        }
        Insert: {
          id?: string
          job_application_id: string
          job_id: string
          rank: number
          score: number
          updated_at?: string
        }
        Update: {
          id?: string
          job_application_id?: string
          job_id?: string
          rank?: number
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_top_candidates_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_top_candidates_job_id_fkey"
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
          hiring_config: Json
          hiring_style: string
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
          weekly_hours: number | null
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
          hiring_config?: Json
          hiring_style?: string
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
          weekly_hours?: number | null
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
          hiring_config?: Json
          hiring_style?: string
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
          weekly_hours?: number | null
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
      journeys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          icon_name: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          icon_name?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          icon_name?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      partners: {
        Row: {
          contractor_user_id: string
          created_at: string
          discount_percent: number | null
          display_name: string
          id: string
          is_active: boolean
          logo_url: string | null
          stripe_coupon_id: string | null
          updated_at: string
        }
        Insert: {
          contractor_user_id: string
          created_at?: string
          discount_percent?: number | null
          display_name: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          stripe_coupon_id?: string | null
          updated_at?: string
        }
        Update: {
          contractor_user_id?: string
          created_at?: string
          discount_percent?: number | null
          display_name?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          stripe_coupon_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_products: {
        Row: {
          coming_soon: boolean
          created_at: string | null
          description: string | null
          features: Json | null
          hidden: boolean | null
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
          coming_soon?: boolean
          created_at?: string | null
          description?: string | null
          features?: Json | null
          hidden?: boolean | null
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
          coming_soon?: boolean
          created_at?: string | null
          description?: string | null
          features?: Json | null
          hidden?: boolean | null
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
      referrals: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
          user_agent: string | null
          verified_at: string | null
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          user_agent?: string | null
          verified_at?: string | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          user_agent?: string | null
          verified_at?: string | null
          voided_at?: string | null
          voided_reason?: string | null
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
      topic_hubs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          journey_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          journey_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          journey_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_hubs_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
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
      calculate_referral_bonus_credits: {
        Args: { verified_count: number }
        Returns: number
      }
      check_job_application_slot: {
        Args: { p_job_id: string }
        Returns: boolean
      }
      cleanup_scheduled_conversations: { Args: never; Returns: number }
      contractor_has_published_jobs: {
        Args: { _contractor_profile_id: string }
        Returns: boolean
      }
      generate_contractor_referral_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_referral_credits_balance: {
        Args: { _user_id: string }
        Returns: number
      }
      get_unread_message_count: { Args: { _user_id: string }; Returns: number }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_referral_premium_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_article_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_text: string
          scope_article_id?: string
        }
        Returns: {
          article_id: string
          chunk_text: string
          similarity: number
          slug: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "contractor" | "employee" | "writer"
      article_type: "qa" | "guide" | "checklist"
      job_status: "draft" | "published" | "closed" | "filled" | "private"
      referral_status: "pending" | "verified" | "voided"
      subscription_status: "active" | "cancelled" | "expired" | "pending"
      user_stage: "before_arrival" | "arrival" | "first_30_days" | "living_here"
      visa_type: "all" | "student" | "worker" | "whv" | "tourist" | "resident"
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
      article_type: ["qa", "guide", "checklist"],
      job_status: ["draft", "published", "closed", "filled", "private"],
      referral_status: ["pending", "verified", "voided"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
      user_stage: ["before_arrival", "arrival", "first_30_days", "living_here"],
      visa_type: ["all", "student", "worker", "whv", "tourist", "resident"],
    },
  },
} as const
