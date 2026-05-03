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
      accounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_user_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_user_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          request_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          request_id?: string | null
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          request_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_id: string
          context: Json
          created_at: string
          deleted_at: string | null
          id: string
          object_id: string
          object_table: string
          occurred_at: string
          user_id: string
          verb: string
        }
        Insert: {
          actor_id: string
          context?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          object_id: string
          object_table: string
          occurred_at?: string
          user_id: string
          verb: string
        }
        Update: {
          actor_id?: string
          context?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          object_id?: string
          object_table?: string
          occurred_at?: string
          user_id?: string
          verb?: string
        }
        Relationships: []
      }
      agent_invites: {
        Row: {
          account_id: string
          contact_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          redeemed_at: string | null
          redeemed_by_user_id: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_invites_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metrics: {
        Row: {
          contact_id: string
          created_at: string
          escrows_closed: number
          escrows_opened: number
          id: string
          period: string
          referral_source: string | null
          revenue: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          escrows_closed?: number
          escrows_opened?: number
          id?: string
          period: string
          referral_source?: string | null
          revenue?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          escrows_closed?: number
          escrows_opened?: number
          id?: string
          period?: string
          referral_source?: string | null
          revenue?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_metrics_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_cache: {
        Row: {
          accessed_at: string
          cache_key: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          feature: string
          model: string | null
          user_id: string
          value: Json
        }
        Insert: {
          accessed_at?: string
          cache_key: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          feature: string
          model?: string | null
          user_id?: string
          value: Json
        }
        Update: {
          accessed_at?: string
          cache_key?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          feature?: string
          model?: string | null
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cache_creation_tokens: number
          cache_read_tokens: number
          context: Json
          cost_usd: number
          created_at: string
          deleted_at: string | null
          feature: string
          id: string
          input_tokens: number
          model: string
          occurred_at: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          cache_creation_tokens?: number
          cache_read_tokens?: number
          context?: Json
          cost_usd?: number
          created_at?: string
          deleted_at?: string | null
          feature: string
          id?: string
          input_tokens?: number
          model: string
          occurred_at?: string
          output_tokens?: number
          user_id: string
        }
        Update: {
          cache_creation_tokens?: number
          cache_read_tokens?: number
          context?: Json
          cost_usd?: number
          created_at?: string
          deleted_at?: string | null
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          occurred_at?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      api_usage_log: {
        Row: {
          adviser_call_count: number
          adviser_called: boolean
          cost_estimate_cents: number
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          error: string | null
          executor_model: string
          feature_key: string
          id: string
          input_tokens: number
          output_tokens: number
          user_id: string
        }
        Insert: {
          adviser_call_count?: number
          adviser_called?: boolean
          cost_estimate_cents?: number
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          error?: string | null
          executor_model: string
          feature_key: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string
        }
        Update: {
          adviser_call_count?: number
          adviser_called?: boolean
          cost_estimate_cents?: number
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          error?: string | null
          executor_model?: string
          feature_key?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      attendees: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          invited_at: string | null
          notes: string | null
          recorded_at: string | null
          responded_at: string | null
          rsvp_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          invited_at?: string | null
          notes?: string | null
          recorded_at?: string | null
          responded_at?: string | null
          rsvp_status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          invited_at?: string | null
          notes?: string | null
          recorded_at?: string | null
          responded_at?: string | null
          rsvp_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendees_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body_html: string
          body_text: string
          created_at: string
          deleted_at: string | null
          id: string
          narrative_payload: Json
          recipient_list_slug: string
          rejected_at: string | null
          rejected_reason: string | null
          send_summary: Json | null
          sent_at: string | null
          status: string
          subject: string
          template_slug: string
          template_version: number | null
          updated_at: string
          variables: Json
          week_of: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body_html: string
          body_text: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          narrative_payload?: Json
          recipient_list_slug: string
          rejected_at?: string | null
          rejected_reason?: string | null
          send_summary?: Json | null
          sent_at?: string | null
          status?: string
          subject: string
          template_slug: string
          template_version?: number | null
          updated_at?: string
          variables?: Json
          week_of: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body_html?: string
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          narrative_payload?: Json
          recipient_list_slug?: string
          rejected_at?: string | null
          rejected_reason?: string | null
          send_summary?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_slug?: string
          template_version?: number | null
          updated_at?: string
          variables?: Json
          week_of?: string
        }
        Relationships: []
      }
      campaign_enrollments: {
        Row: {
          account_id: string
          campaign_id: string
          completed_at: string | null
          contact_id: string
          created_at: string
          current_step: number
          deleted_at: string | null
          enrolled_at: string
          id: string
          next_action_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          campaign_id: string
          completed_at?: string | null
          contact_id: string
          created_at?: string
          current_step?: number
          deleted_at?: string | null
          enrolled_at?: string
          id?: string
          next_action_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step?: number
          deleted_at?: string | null
          enrolled_at?: string
          id?: string
          next_action_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_step_completions: {
        Row: {
          completed_at: string
          completed_by: string | null
          created_at: string
          deleted_at: string | null
          email_delivered: boolean | null
          email_opened: boolean | null
          email_sent_at: string | null
          enrollment_id: string
          id: string
          notes: string | null
          resend_message_id: string | null
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          email_delivered?: boolean | null
          email_opened?: boolean | null
          email_sent_at?: string | null
          enrollment_id: string
          id?: string
          notes?: string | null
          resend_message_id?: string | null
          step_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          email_delivered?: boolean | null
          email_opened?: boolean | null
          email_sent_at?: string | null
          enrollment_id?: string
          id?: string
          notes?: string | null
          resend_message_id?: string | null
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_step_completions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "campaign_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_steps: {
        Row: {
          awareness_level: string | null
          campaign_id: string
          content: string | null
          created_at: string
          delay_days: number
          deleted_at: string | null
          email_body_html: string | null
          email_subject: string | null
          id: string
          step_goal: string | null
          step_number: number
          step_type: string
          template_slug: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          awareness_level?: string | null
          campaign_id: string
          content?: string | null
          created_at?: string
          delay_days?: number
          deleted_at?: string | null
          email_body_html?: string | null
          email_subject?: string | null
          id?: string
          step_goal?: string | null
          step_number?: number
          step_type?: string
          template_slug?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          awareness_level?: string | null
          campaign_id?: string
          content?: string | null
          created_at?: string
          delay_days?: number
          deleted_at?: string | null
          email_body_html?: string | null
          email_subject?: string | null
          id?: string
          step_goal?: string | null
          step_number?: number
          step_type?: string
          template_slug?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          enrolled_count: number
          id: string
          name: string
          status: string
          step_count: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          enrolled_count?: number
          id?: string
          name: string
          status?: string
          step_count?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          enrolled_count?: number
          id?: string
          name?: string
          status?: string
          step_count?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      captures: {
        Row: {
          account_id: string
          created_at: string
          id: string
          metadata: Json | null
          parsed_contact_id: string | null
          parsed_intent: string | null
          parsed_payload: Json
          processed: boolean
          raw_text: string
          source: string
          status: string
          suggested_target: Json | null
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          parsed_contact_id?: string | null
          parsed_intent?: string | null
          parsed_payload?: Json
          processed?: boolean
          raw_text: string
          source?: string
          status?: string
          suggested_target?: Json | null
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          parsed_contact_id?: string | null
          parsed_intent?: string | null
          parsed_payload?: Json
          processed?: boolean
          raw_text?: string
          source?: string
          status?: string
          suggested_target?: Json | null
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_parsed_contact_id_fkey"
            columns: ["parsed_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_parsed_contact_id_fkey"
            columns: ["parsed_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string
          agent_logo_url: string | null
          brand_colors: Json | null
          brokerage: string | null
          brokerage_logo_url: string | null
          contact_md_path: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          escrow_officer: string | null
          farm_area: string | null
          farm_zips: string[] | null
          first_name: string
          font_kit: string | null
          full_name: string | null
          headshot_url: string | null
          health_score: number | null
          id: string
          instagram_handle: string | null
          internal_note: string | null
          last_name: string
          last_touchpoint: string | null
          lender_partner_id: string | null
          license_number: string | null
          linkedin_url: string | null
          metadata: Json
          next_action: string | null
          next_followup: string | null
          notes: string | null
          palette: string | null
          phone: string | null
          preferred_channel: string | null
          referred_by: string | null
          rep_pulse: number | null
          rep_pulse_updated_at: string | null
          slug: string | null
          source: string | null
          stage: string
          tagline: string | null
          tags: string[] | null
          tier: string | null
          title: string | null
          type: string
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          account_id: string
          agent_logo_url?: string | null
          brand_colors?: Json | null
          brokerage?: string | null
          brokerage_logo_url?: string | null
          contact_md_path?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          escrow_officer?: string | null
          farm_area?: string | null
          farm_zips?: string[] | null
          first_name: string
          font_kit?: string | null
          full_name?: string | null
          headshot_url?: string | null
          health_score?: number | null
          id?: string
          instagram_handle?: string | null
          internal_note?: string | null
          last_name: string
          last_touchpoint?: string | null
          lender_partner_id?: string | null
          license_number?: string | null
          linkedin_url?: string | null
          metadata?: Json
          next_action?: string | null
          next_followup?: string | null
          notes?: string | null
          palette?: string | null
          phone?: string | null
          preferred_channel?: string | null
          referred_by?: string | null
          rep_pulse?: number | null
          rep_pulse_updated_at?: string | null
          slug?: string | null
          source?: string | null
          stage?: string
          tagline?: string | null
          tags?: string[] | null
          tier?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Update: {
          account_id?: string
          agent_logo_url?: string | null
          brand_colors?: Json | null
          brokerage?: string | null
          brokerage_logo_url?: string | null
          contact_md_path?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          escrow_officer?: string | null
          farm_area?: string | null
          farm_zips?: string[] | null
          first_name?: string
          font_kit?: string | null
          full_name?: string | null
          headshot_url?: string | null
          health_score?: number | null
          id?: string
          instagram_handle?: string | null
          internal_note?: string | null
          last_name?: string
          last_touchpoint?: string | null
          lender_partner_id?: string | null
          license_number?: string | null
          linkedin_url?: string | null
          metadata?: Json
          next_action?: string | null
          next_followup?: string | null
          notes?: string | null
          palette?: string | null
          phone?: string | null
          preferred_channel?: string | null
          referred_by?: string | null
          rep_pulse?: number | null
          rep_pulse_updated_at?: string | null
          slug?: string | null
          source?: string | null
          stage?: string
          tagline?: string | null
          tags?: string[] | null
          tier?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lender_partner_id_fkey"
            columns: ["lender_partner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lender_partner_id_fkey"
            columns: ["lender_partner_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      design_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["design_asset_type"]
          contact_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          listing_address: string | null
          name: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["design_asset_type"]
          contact_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          listing_address?: string | null
          name: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["design_asset_type"]
          contact_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          listing_address?: string | null
          name?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_assets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          account_id: string
          approved_at: string | null
          approved_by: string | null
          audit_log: Json
          created_at: string
          created_in_gmail_draft_id: string | null
          created_in_obsidian_file_path: string | null
          draft_body_html: string | null
          draft_body_plain: string | null
          draft_subject: string | null
          email_id: string
          escalation_flag: string | null
          escalation_reason: string | null
          expires_at: string
          generated_at: string
          id: string
          metadata: Json
          revisions_count: number
          sent_at: string | null
          sent_via: string | null
          status: Database["public"]["Enums"]["email_draft_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          approved_at?: string | null
          approved_by?: string | null
          audit_log?: Json
          created_at?: string
          created_in_gmail_draft_id?: string | null
          created_in_obsidian_file_path?: string | null
          draft_body_html?: string | null
          draft_body_plain?: string | null
          draft_subject?: string | null
          email_id: string
          escalation_flag?: string | null
          escalation_reason?: string | null
          expires_at?: string
          generated_at?: string
          id?: string
          metadata?: Json
          revisions_count?: number
          sent_at?: string | null
          sent_via?: string | null
          status?: Database["public"]["Enums"]["email_draft_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          approved_at?: string | null
          approved_by?: string | null
          audit_log?: Json
          created_at?: string
          created_in_gmail_draft_id?: string | null
          created_in_obsidian_file_path?: string | null
          draft_body_html?: string | null
          draft_body_plain?: string | null
          draft_subject?: string | null
          email_id?: string
          escalation_flag?: string | null
          escalation_reason?: string | null
          expires_at?: string
          generated_at?: string
          id?: string
          metadata?: Json
          revisions_count?: number
          sent_at?: string | null
          sent_via?: string | null
          status?: Database["public"]["Enums"]["email_draft_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          campaign: string
          contact_id: string
          created_at: string
          id: string
          resend_id: string | null
          sent_at: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign: string
          contact_id: string
          created_at?: string
          id?: string
          resend_id?: string | null
          sent_at: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          campaign?: string
          contact_id?: string
          created_at?: string
          id?: string
          resend_id?: string | null
          sent_at?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          body_html: string | null
          body_plain: string | null
          contact_domain: string | null
          contact_id: string | null
          created_at: string
          from_email: string
          from_name: string | null
          gmail_id: string
          gmail_thread_id: string | null
          id: string
          is_contact_match: boolean
          is_potential_re_pro: boolean
          is_unread: boolean
          labels: Json
          last_checked_at: string
          snippet: string | null
          subject: string
          synced_at: string
          user_id: string
        }
        Insert: {
          body_html?: string | null
          body_plain?: string | null
          contact_domain?: string | null
          contact_id?: string | null
          created_at: string
          from_email: string
          from_name?: string | null
          gmail_id: string
          gmail_thread_id?: string | null
          id?: string
          is_contact_match?: boolean
          is_potential_re_pro?: boolean
          is_unread?: boolean
          labels?: Json
          last_checked_at?: string
          snippet?: string | null
          subject: string
          synced_at?: string
          user_id?: string
        }
        Update: {
          body_html?: string | null
          body_plain?: string | null
          contact_domain?: string | null
          contact_id?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          gmail_id?: string
          gmail_thread_id?: string | null
          id?: string
          is_contact_match?: boolean
          is_potential_re_pro?: boolean
          is_unread?: boolean
          labels?: Json
          last_checked_at?: string
          snippet?: string | null
          subject?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json
          created_at: string
          endpoint: string | null
          error_code: number | null
          error_message: string | null
          id: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          endpoint?: string | null
          error_code?: number | null
          error_message?: string | null
          id?: string
          resolved?: boolean
          user_id?: string
        }
        Update: {
          context?: Json
          created_at?: string
          endpoint?: string | null
          error_code?: number | null
          error_message?: string | null
          id?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      event_templates: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          default_location: string | null
          deleted_at: string | null
          end_time: string
          id: string
          lender_flag: string
          location_type: string
          name: string
          notes: string | null
          owner_contact_id: string
          rrule: string | null
          start_time: string
          updated_at: string
          user_id: string
          week_of_month: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          default_location?: string | null
          deleted_at?: string | null
          end_time: string
          id?: string
          lender_flag?: string
          location_type: string
          name: string
          notes?: string | null
          owner_contact_id: string
          rrule?: string | null
          start_time: string
          updated_at?: string
          user_id?: string
          week_of_month: number
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          default_location?: string | null
          deleted_at?: string | null
          end_time?: string
          id?: string
          lender_flag?: string
          location_type?: string
          name?: string
          notes?: string | null
          owner_contact_id?: string
          rrule?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
          week_of_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_templates_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          account_id: string
          attendees: Json
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_at: string
          event_template_id: string | null
          gcal_event_id: string | null
          id: string
          location: string | null
          location_override: string | null
          occurrence_status: Database["public"]["Enums"]["event_occurrence_status"]
          project_id: string | null
          source: Database["public"]["Enums"]["event_source"]
          start_at: string
          synced_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          attendees?: Json
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_at: string
          event_template_id?: string | null
          gcal_event_id?: string | null
          id?: string
          location?: string | null
          location_override?: string | null
          occurrence_status?: Database["public"]["Enums"]["event_occurrence_status"]
          project_id?: string | null
          source: Database["public"]["Enums"]["event_source"]
          start_at: string
          synced_at?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          attendees?: Json
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_at?: string
          event_template_id?: string | null
          gcal_event_id?: string | null
          id?: string
          location?: string | null
          location_override?: string | null
          occurrence_status?: Database["public"]["Enums"]["event_occurrence_status"]
          project_id?: string | null
          source?: Database["public"]["Enums"]["event_source"]
          start_at?: string
          synced_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_template_id_fkey"
            columns: ["event_template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          contact_id: string | null
          contact_name: string | null
          contact_tier: string | null
          created_at: string
          dismissed_at: string | null
          gmail_thread_id: string
          id: string
          matched_rules: Json
          received_at: string
          score: number
          sender_email: string
          sender_name: string
          snippet: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          contact_name?: string | null
          contact_tier?: string | null
          created_at?: string
          dismissed_at?: string | null
          gmail_thread_id: string
          id?: string
          matched_rules?: Json
          received_at: string
          score?: number
          sender_email: string
          sender_name?: string
          snippet?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Update: {
          contact_id?: string | null
          contact_name?: string | null
          contact_tier?: string | null
          created_at?: string
          dismissed_at?: string | null
          gmail_thread_id?: string
          id?: string
          matched_rules?: Json
          received_at?: string
          score?: number
          sender_email?: string
          sender_name?: string
          snippet?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          baths: number | null
          beds: number | null
          city: string | null
          close_date: string | null
          contact_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          headline: string | null
          id: string
          list_date: string | null
          listing_url: string | null
          lot_size: string | null
          mls_number: string | null
          mls_status: string | null
          photo_urls: string[] | null
          price: number | null
          property_address: string
          property_type: string
          sqft: number | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
          virtual_tour_url: string | null
          year_built: number | null
          zip: string | null
        }
        Insert: {
          baths?: number | null
          beds?: number | null
          city?: string | null
          close_date?: string | null
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          headline?: string | null
          id?: string
          list_date?: string | null
          listing_url?: string | null
          lot_size?: string | null
          mls_number?: string | null
          mls_status?: string | null
          photo_urls?: string[] | null
          price?: number | null
          property_address: string
          property_type?: string
          sqft?: number | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          virtual_tour_url?: string | null
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          baths?: number | null
          beds?: number | null
          city?: string | null
          close_date?: string | null
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          headline?: string | null
          id?: string
          list_date?: string | null
          listing_url?: string | null
          lot_size?: string | null
          mls_number?: string | null
          mls_status?: string | null
          photo_urls?: string[] | null
          price?: number | null
          property_address?: string
          property_type?: string
          sqft?: number | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          virtual_tour_url?: string | null
          year_built?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      message_events: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_type: Database["public"]["Enums"]["message_event_type"]
          id: string
          message_log_id: string
          payload: Json
          provider_message_id: string | null
          received_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_type: Database["public"]["Enums"]["message_event_type"]
          id?: string
          message_log_id: string
          payload?: Json
          provider_message_id?: string | null
          received_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_type?: Database["public"]["Enums"]["message_event_type"]
          id?: string
          message_log_id?: string
          payload?: Json
          provider_message_id?: string | null
          received_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_events_message_log_id_fkey"
            columns: ["message_log_id"]
            isOneToOne: false
            referencedRelation: "messages_log"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_log: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_sequence: Json
          id: string
          provider_message_id: string | null
          recipient_email: string
          send_mode: Database["public"]["Enums"]["template_send_mode"]
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_sequence?: Json
          id?: string
          provider_message_id?: string | null
          recipient_email: string
          send_mode: Database["public"]["Enums"]["template_send_mode"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_sequence?: Json
          id?: string
          provider_message_id?: string | null
          recipient_email?: string
          send_mode?: Database["public"]["Enums"]["template_send_mode"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      morning_briefs: {
        Row: {
          brief_date: string
          brief_json: Json
          brief_text: string
          contacts_scored: number
          created_at: string
          deleted_at: string | null
          errors: Json | null
          generated_at: string
          id: string
          model: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          brief_date: string
          brief_json: Json
          brief_text: string
          contacts_scored?: number
          created_at?: string
          deleted_at?: string | null
          errors?: Json | null
          generated_at?: string
          id?: string
          model: string
          usage?: Json | null
          user_id?: string
        }
        Update: {
          brief_date?: string
          brief_json?: Json
          brief_text?: string
          contacts_scored?: number
          created_at?: string
          deleted_at?: string | null
          errors?: Json | null
          generated_at?: string
          id?: string
          model?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          provider: string
          refresh_token: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          user_id?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          account_id: string
          actual_close_date: string | null
          buyer_name: string | null
          closed_at: string | null
          commission_rate: number | null
          contact_id: string
          contract_date: string | null
          created_at: string | null
          deleted_at: string | null
          earnest_money: number | null
          escrow_company: string | null
          escrow_number: string | null
          escrow_officer: string | null
          escrow_open_date: string | null
          expected_close_date: string | null
          id: string
          lender_name: string | null
          lender_partner_id: string | null
          notes: string | null
          opened_at: string | null
          property_address: string
          property_city: string | null
          property_state: string | null
          property_zip: string | null
          sale_price: number | null
          scheduled_close_date: string | null
          seller_name: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          title_company: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          actual_close_date?: string | null
          buyer_name?: string | null
          closed_at?: string | null
          commission_rate?: number | null
          contact_id: string
          contract_date?: string | null
          created_at?: string | null
          deleted_at?: string | null
          earnest_money?: number | null
          escrow_company?: string | null
          escrow_number?: string | null
          escrow_officer?: string | null
          escrow_open_date?: string | null
          expected_close_date?: string | null
          id?: string
          lender_name?: string | null
          lender_partner_id?: string | null
          notes?: string | null
          opened_at?: string | null
          property_address: string
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          sale_price?: number | null
          scheduled_close_date?: string | null
          seller_name?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          title_company?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          account_id?: string
          actual_close_date?: string | null
          buyer_name?: string | null
          closed_at?: string | null
          commission_rate?: number | null
          contact_id?: string
          contract_date?: string | null
          created_at?: string | null
          deleted_at?: string | null
          earnest_money?: number | null
          escrow_company?: string | null
          escrow_number?: string | null
          escrow_officer?: string | null
          escrow_open_date?: string | null
          expected_close_date?: string | null
          id?: string
          lender_name?: string | null
          lender_partner_id?: string | null
          notes?: string | null
          opened_at?: string | null
          property_address?: string
          property_city?: string | null
          property_state?: string | null
          property_zip?: string | null
          sale_price?: number | null
          scheduled_close_date?: string | null
          seller_name?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          title_company?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      project_touchpoints: {
        Row: {
          created_at: string
          deleted_at: string | null
          due_at: string | null
          entity_id: string
          entity_table: string
          id: string
          last_reminded_at: string | null
          note: string | null
          occurred_at: string | null
          project_id: string
          touchpoint_type: Database["public"]["Enums"]["project_touchpoint_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          entity_id: string
          entity_table: string
          id?: string
          last_reminded_at?: string | null
          note?: string | null
          occurred_at?: string | null
          project_id: string
          touchpoint_type: Database["public"]["Enums"]["project_touchpoint_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          due_at?: string | null
          entity_id?: string
          entity_table?: string
          id?: string
          last_reminded_at?: string | null
          note?: string | null
          occurred_at?: string | null
          project_id?: string
          touchpoint_type?: Database["public"]["Enums"]["project_touchpoint_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_touchpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json
          owner_contact_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          owner_contact_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          owner_contact_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      referral_partners: {
        Row: {
          category: string
          company_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          ideal_use_cases: string | null
          is_active: boolean
          last_referred_at: string | null
          name: string
          phone: string | null
          referral_count: number
          relationship_notes: string | null
          service_area: string | null
          specialties: string[] | null
          trust_level: number | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          category: string
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          ideal_use_cases?: string | null
          is_active?: boolean
          last_referred_at?: string | null
          name: string
          phone?: string | null
          referral_count?: number
          relationship_notes?: string | null
          service_area?: string | null
          specialties?: string[] | null
          trust_level?: number | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Update: {
          category?: string
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          ideal_use_cases?: string | null
          is_active?: boolean
          last_referred_at?: string | null
          name?: string
          phone?: string | null
          referral_count?: number
          relationship_notes?: string | null
          service_area?: string | null
          specialties?: string[] | null
          trust_level?: number | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      relationship_health_config: {
        Row: {
          half_life_days: number
          id: number
          max_age_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          half_life_days?: number
          id?: number
          max_age_days?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          half_life_days?: number
          id?: number
          max_age_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      relationship_health_scores: {
        Row: {
          computed_at: string
          contact_id: string
          deleted_at: string | null
          half_life_days: number
          last_touchpoint_at: string | null
          score: number
          touchpoint_count: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          contact_id: string
          deleted_at?: string | null
          half_life_days: number
          last_touchpoint_at?: string | null
          score?: number
          touchpoint_count?: number
          user_id?: string
        }
        Update: {
          computed_at?: string
          contact_id?: string
          deleted_at?: string | null
          half_life_days?: number
          last_touchpoint_at?: string | null
          score?: number
          touchpoint_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_health_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_health_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_health_touchpoint_weights: {
        Row: {
          touchpoint_type: Database["public"]["Enums"]["project_touchpoint_type"]
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          touchpoint_type: Database["public"]["Enums"]["project_touchpoint_type"]
          updated_at?: string
          user_id?: string
          weight: number
        }
        Update: {
          touchpoint_type?: Database["public"]["Enums"]["project_touchpoint_type"]
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: string
          content: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          file_path: string | null
          id: string
          is_active: boolean
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          url: string | null
          usage_notes: string | null
          user_id: string
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string
          url?: string | null
          usage_notes?: string | null
          user_id?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
          usage_notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          account_id: string
          action_hint: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          due_reason: string | null
          id: string
          is_recurring: boolean
          linked_interaction_id: string | null
          priority: string
          project_id: string | null
          recurrence_rule: string | null
          snoozed_until: string | null
          source: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          action_hint?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          due_reason?: string | null
          id?: string
          is_recurring?: boolean
          linked_interaction_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_rule?: string | null
          snoozed_until?: string | null
          source?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          action_hint?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          due_reason?: string | null
          id?: string
          is_recurring?: boolean
          linked_interaction_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_rule?: string | null
          snoozed_until?: string | null
          source?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_interaction_id_fkey"
            columns: ["linked_interaction_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_interaction_id_fkey"
            columns: ["linked_interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body_html: string
          body_text: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["template_kind"]
          name: string
          send_mode: Database["public"]["Enums"]["template_send_mode"]
          slug: string
          subject: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["template_kind"]
          name: string
          send_mode: Database["public"]["Enums"]["template_send_mode"]
          slug: string
          subject: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          name?: string
          send_mode?: Database["public"]["Enums"]["template_send_mode"]
          slug?: string
          subject?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      ticket_items: {
        Row: {
          created_at: string | null
          description: string | null
          design_url: string | null
          id: string
          product_type: Database["public"]["Enums"]["product_type"]
          quantity: number
          request_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          design_url?: string | null
          id?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          quantity?: number
          request_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          design_url?: string | null
          id?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_items_ticket_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          listing_data: Json | null
          notes: string | null
          priority: Database["public"]["Enums"]["material_request_priority"]
          request_type: Database["public"]["Enums"]["material_request_type"]
          source: string
          status: Database["public"]["Enums"]["material_request_status"]
          submitted_at: string | null
          submitter_email: string | null
          submitter_name: string | null
          submitter_phone: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          listing_data?: Json | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["material_request_priority"]
          request_type?: Database["public"]["Enums"]["material_request_type"]
          source?: string
          status?: Database["public"]["Enums"]["material_request_status"]
          submitted_at?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          listing_data?: Json | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["material_request_priority"]
          request_type?: Database["public"]["Enums"]["material_request_type"]
          source?: string
          status?: Database["public"]["Enums"]["material_request_status"]
          submitted_at?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_snapshot: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          id: string
          market_label: string
          market_slug: string
          narrative_seed: string | null
          pulled_at: string
          week_of: string
        }
        Insert: {
          created_at?: string
          data: Json
          deleted_at?: string | null
          id?: string
          market_label: string
          market_slug: string
          narrative_seed?: string | null
          pulled_at?: string
          week_of: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          market_label?: string
          market_slug?: string
          narrative_seed?: string | null
          pulled_at?: string
          week_of?: string
        }
        Relationships: []
      }
    }
    Views: {
      contacts_spec_view: {
        Row: {
          agent_logo_url: string | null
          brand_colors: Json | null
          brokerage: string | null
          brokerage_logo_url: string | null
          contact_md_path: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          escrow_officer: string | null
          farm_area: string | null
          farm_zips: string[] | null
          first_name: string | null
          font_kit: string | null
          full_name: string | null
          headshot_url: string | null
          health_score: number | null
          id: string | null
          instagram_handle: string | null
          internal_note: string | null
          is_dormant: boolean | null
          last_name: string | null
          last_touchpoint: string | null
          lender_partner_id: string | null
          license_number: string | null
          linkedin_url: string | null
          metadata: Json | null
          next_action: string | null
          next_followup: string | null
          notes: string | null
          palette: string | null
          phone: string | null
          preferred_channel: string | null
          referred_by: string | null
          rep_pulse: number | null
          rep_pulse_updated_at: string | null
          role: string | null
          source: string | null
          stage: string | null
          tags: string[] | null
          tier: string | null
          title: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          agent_logo_url?: string | null
          brand_colors?: Json | null
          brokerage?: string | null
          brokerage_logo_url?: string | null
          contact_md_path?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          escrow_officer?: string | null
          farm_area?: string | null
          farm_zips?: string[] | null
          first_name?: string | null
          font_kit?: string | null
          full_name?: string | null
          headshot_url?: string | null
          health_score?: number | null
          id?: string | null
          instagram_handle?: string | null
          internal_note?: string | null
          is_dormant?: never
          last_name?: string | null
          last_touchpoint?: string | null
          lender_partner_id?: string | null
          license_number?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          next_action?: string | null
          next_followup?: string | null
          notes?: string | null
          palette?: string | null
          phone?: string | null
          preferred_channel?: string | null
          referred_by?: string | null
          rep_pulse?: number | null
          rep_pulse_updated_at?: string | null
          role?: never
          source?: string | null
          stage?: string | null
          tags?: string[] | null
          tier?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          agent_logo_url?: string | null
          brand_colors?: Json | null
          brokerage?: string | null
          brokerage_logo_url?: string | null
          contact_md_path?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          escrow_officer?: string | null
          farm_area?: string | null
          farm_zips?: string[] | null
          first_name?: string | null
          font_kit?: string | null
          full_name?: string | null
          headshot_url?: string | null
          health_score?: number | null
          id?: string | null
          instagram_handle?: string | null
          internal_note?: string | null
          is_dormant?: never
          last_name?: string | null
          last_touchpoint?: string | null
          lender_partner_id?: string | null
          license_number?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          next_action?: string | null
          next_followup?: string | null
          notes?: string | null
          palette?: string | null
          phone?: string | null
          preferred_channel?: string | null
          referred_by?: string | null
          rep_pulse?: number | null
          rep_pulse_updated_at?: string | null
          role?: never
          source?: string | null
          stage?: string | null
          tags?: string[] | null
          tier?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lender_partner_id_fkey"
            columns: ["lender_partner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lender_partner_id_fkey"
            columns: ["lender_partner_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts_observation: {
        Row: {
          acted_at: string | null
          action_taken: string | null
          contact_id: string | null
          contact_tier: string | null
          draft_id: string | null
          escalation_flag: string | null
          generated_at: string | null
          time_to_action_seconds: number | null
          was_revised: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_spec_view"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          direction: string | null
          duration_minutes: number | null
          id: string | null
          occurred_at: string | null
          summary: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: never
          created_at?: string | null
          deleted_at?: string | null
          direction?: never
          duration_minutes?: never
          id?: string | null
          occurred_at?: string | null
          summary?: never
          type?: never
          user_id?: string | null
        }
        Update: {
          contact_id?: never
          created_at?: string | null
          deleted_at?: string | null
          direction?: never
          duration_minutes?: never
          id?: string | null
          occurred_at?: string | null
          summary?: never
          type?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_relationship_health_score: {
        Args: { p_contact_id: string }
        Returns: {
          half_life_days: number
          last_touchpoint_at: string
          score: number
          touchpoint_count: number
        }[]
      }
      current_day_ai_spend_usd: { Args: never; Returns: number }
      get_public_agent_by_slug: {
        Args: { p_slug: string }
        Returns: {
          brokerage: string
          email: string
          first_name: string
          headshot_url: string
          id: string
          last_name: string
          phone: string
          slug: string
          tagline: string
          title: string
          website_url: string
        }[]
      }
      get_public_agent_slugs: {
        Args: never
        Returns: {
          slug: string
        }[]
      }
      increment_rate_limit: {
        Args: { p_key: string; p_window_start: string }
        Returns: number
      }
      recompute_all_relationship_health_scores: {
        Args: { p_batch_limit?: number }
        Returns: number
      }
      redeem_agent_invite: {
        Args: { p_token_hash: string }
        Returns: {
          account_id: string
          contact_id: string
          email: string
          slug: string
        }[]
      }
      upsert_relationship_health_score: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
    }
    Enums: {
      deal_stage:
        | "under_contract"
        | "in_escrow"
        | "clear_to_close"
        | "closed"
        | "fell_through"
      design_asset_type:
        | "flyer"
        | "brochure"
        | "door_hanger"
        | "eddm"
        | "postcard"
        | "social"
        | "presentation"
        | "other"
      email_draft_status:
        | "generated"
        | "approved"
        | "sent"
        | "discarded"
        | "revised"
      event_occurrence_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "canceled"
      event_source: "gcal_pull" | "dashboard_create"
      follow_up_status: "pending" | "completed" | "snoozed" | "cancelled"
      interaction_type:
        | "call"
        | "text"
        | "email"
        | "meeting"
        | "broker_open"
        | "lunch"
        | "note"
        | "email_sent"
        | "email_received"
        | "event"
      material_request_priority: "standard" | "rush"
      material_request_status:
        | "draft"
        | "submitted"
        | "in_production"
        | "complete"
      material_request_type: "print_ready" | "design_help" | "template_request"
      message_event_type:
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "complained"
      message_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "opened"
        | "clicked"
        | "failed"
      opportunity_stage:
        | "prospect"
        | "under_contract"
        | "in_escrow"
        | "closed"
        | "fell_through"
      product_type:
        | "flyer"
        | "brochure"
        | "door_hanger"
        | "eddm"
        | "postcard"
        | "other"
      project_status: "active" | "paused" | "closed"
      project_touchpoint_type:
        | "email"
        | "event"
        | "voice_memo"
        | "contact_note"
        | "listing_setup"
      project_type:
        | "agent_bd"
        | "home_tour"
        | "happy_hour"
        | "campaign"
        | "listing"
        | "other"
      template_kind: "transactional" | "campaign" | "newsletter"
      template_send_mode: "resend" | "gmail" | "both"
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
      deal_stage: [
        "under_contract",
        "in_escrow",
        "clear_to_close",
        "closed",
        "fell_through",
      ],
      design_asset_type: [
        "flyer",
        "brochure",
        "door_hanger",
        "eddm",
        "postcard",
        "social",
        "presentation",
        "other",
      ],
      email_draft_status: [
        "generated",
        "approved",
        "sent",
        "discarded",
        "revised",
      ],
      event_occurrence_status: [
        "scheduled",
        "confirmed",
        "completed",
        "canceled",
      ],
      event_source: ["gcal_pull", "dashboard_create"],
      follow_up_status: ["pending", "completed", "snoozed", "cancelled"],
      interaction_type: [
        "call",
        "text",
        "email",
        "meeting",
        "broker_open",
        "lunch",
        "note",
        "email_sent",
        "email_received",
        "event",
      ],
      material_request_priority: ["standard", "rush"],
      material_request_status: [
        "draft",
        "submitted",
        "in_production",
        "complete",
      ],
      material_request_type: ["print_ready", "design_help", "template_request"],
      message_event_type: [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complained",
      ],
      message_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "opened",
        "clicked",
        "failed",
      ],
      opportunity_stage: [
        "prospect",
        "under_contract",
        "in_escrow",
        "closed",
        "fell_through",
      ],
      product_type: [
        "flyer",
        "brochure",
        "door_hanger",
        "eddm",
        "postcard",
        "other",
      ],
      project_status: ["active", "paused", "closed"],
      project_touchpoint_type: [
        "email",
        "event",
        "voice_memo",
        "contact_note",
        "listing_setup",
      ],
      project_type: [
        "agent_bd",
        "home_tour",
        "happy_hour",
        "campaign",
        "listing",
        "other",
      ],
      template_kind: ["transactional", "campaign", "newsletter"],
      template_send_mode: ["resend", "gmail", "both"],
    },
  },
} as const
