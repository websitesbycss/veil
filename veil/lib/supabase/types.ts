export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      photographers: {
        Row: {
          id: string;
          auth_user_id: string;
          full_name: string;
          studio_name: string | null;
          email: string;
          style_notes: string | null;
          ig_access_token: string | null;
          pixieset_webhook_secret: string | null;
          created_at: string;
        };
        Insert: {
          auth_user_id: string;
          full_name: string;
          studio_name?: string | null;
          email: string;
          style_notes?: string | null;
          ig_access_token?: string | null;
          pixieset_webhook_secret?: string | null;
        };
        Update: {
          auth_user_id?: string;
          full_name?: string;
          studio_name?: string | null;
          email?: string;
          style_notes?: string | null;
          ig_access_token?: string | null;
          pixieset_webhook_secret?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          photographer_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          referral_source: "past_client" | "instagram" | "google" | "vendor" | "other" | null;
          referral_client_id: string | null;
          created_at: string;
        };
        Insert: {
          photographer_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          referral_source?: "past_client" | "instagram" | "google" | "vendor" | "other" | null;
          referral_client_id?: string | null;
        };
        Update: {
          photographer_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          referral_source?: "past_client" | "instagram" | "google" | "vendor" | "other" | null;
          referral_client_id?: string | null;
        };
        Relationships: [];
      };
      weddings: {
        Row: {
          id: string;
          photographer_id: string;
          client1_id: string | null;
          client2_id: string | null;
          wedding_date: string | null;
          status: "inquiry" | "consultation" | "booked" | "active" | "delivered" | "archived";
          venue_name: string | null;
          venue_address: string | null;
          venue_lat: number | null;
          venue_lng: number | null;
          ceremony_address: string | null;
          ceremony_lat: number | null;
          ceremony_lng: number | null;
          golden_hour_time: string | null;
          drive_time_minutes: number | null;
          style_vibe: string | null;
          special_requests: string | null;
          pixieset_gallery_id: string | null;
          gallery_delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          photographer_id: string;
          client1_id?: string | null;
          client2_id?: string | null;
          wedding_date?: string | null;
          status?: "inquiry" | "consultation" | "booked" | "active" | "delivered" | "archived";
          venue_name?: string | null;
          venue_address?: string | null;
          venue_lat?: number | null;
          venue_lng?: number | null;
          ceremony_address?: string | null;
          ceremony_lat?: number | null;
          ceremony_lng?: number | null;
          golden_hour_time?: string | null;
          drive_time_minutes?: number | null;
          style_vibe?: string | null;
          special_requests?: string | null;
          pixieset_gallery_id?: string | null;
          gallery_delivered_at?: string | null;
        };
        Update: {
          photographer_id?: string;
          client1_id?: string | null;
          client2_id?: string | null;
          wedding_date?: string | null;
          status?: "inquiry" | "consultation" | "booked" | "active" | "delivered" | "archived";
          venue_name?: string | null;
          venue_address?: string | null;
          venue_lat?: number | null;
          venue_lng?: number | null;
          ceremony_address?: string | null;
          ceremony_lat?: number | null;
          ceremony_lng?: number | null;
          golden_hour_time?: string | null;
          drive_time_minutes?: number | null;
          style_vibe?: string | null;
          special_requests?: string | null;
          pixieset_gallery_id?: string | null;
          gallery_delivered_at?: string | null;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          id: string;
          wedding_id: string;
          side: "client1" | "client2";
          role: string;
          first_name: string;
          last_name: string | null;
          mobility_limited: boolean;
          divorced_from: string | null;
        };
        Insert: {
          wedding_id: string;
          side: "client1" | "client2";
          role: string;
          first_name: string;
          last_name?: string | null;
          mobility_limited?: boolean;
          divorced_from?: string | null;
        };
        Update: {
          wedding_id?: string;
          side?: "client1" | "client2";
          role?: string;
          first_name?: string;
          last_name?: string | null;
          mobility_limited?: boolean;
          divorced_from?: string | null;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          id: string;
          wedding_id: string;
          role: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
        };
        Insert: {
          wedding_id: string;
          role: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
        };
        Update: {
          wedding_id?: string;
          role?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      second_shooters: {
        Row: {
          id: string;
          wedding_id: string;
          name: string;
          pin_hash: string;
        };
        Insert: {
          wedding_id: string;
          name: string;
          pin_hash: string;
        };
        Update: {
          wedding_id?: string;
          name?: string;
          pin_hash?: string;
        };
        Relationships: [];
      };
      shot_list_items: {
        Row: {
          id: string;
          wedding_id: string;
          sort_order: number;
          grouping_label: string;
          notes: string | null;
          completed: boolean;
          completed_by: string | null;
          completed_at: string | null;
        };
        Insert: {
          wedding_id: string;
          sort_order: number;
          grouping_label: string;
          notes?: string | null;
          completed?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
        };
        Update: {
          wedding_id?: string;
          sort_order?: number;
          grouping_label?: string;
          notes?: string | null;
          completed?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      timeline_blocks: {
        Row: {
          id: string;
          wedding_id: string;
          sort_order: number;
          label: string;
          start_time: string;
          duration_minutes: number;
          location: string | null;
          notes: string | null;
        };
        Insert: {
          wedding_id: string;
          sort_order: number;
          label: string;
          start_time: string;
          duration_minutes: number;
          location?: string | null;
          notes?: string | null;
        };
        Update: {
          wedding_id?: string;
          sort_order?: number;
          label?: string;
          start_time?: string;
          duration_minutes?: number;
          location?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      email_samples: {
        Row: {
          id: string;
          photographer_id: string;
          subject: string | null;
          body: string;
          tone_tags: string | null;
          created_at: string;
        };
        Insert: {
          photographer_id: string;
          subject?: string | null;
          body: string;
          tone_tags?: string | null;
        };
        Update: {
          photographer_id?: string;
          subject?: string | null;
          body?: string;
          tone_tags?: string | null;
        };
        Relationships: [];
      };
      ai_drafts: {
        Row: {
          id: string;
          wedding_id: string;
          photographer_id: string;
          draft_type: "email" | "blog_post" | "instagram_caption" | "quote" | "anniversary_email";
          content: string;
          status: "draft" | "approved" | "sent" | "published";
          created_at: string;
        };
        Insert: {
          wedding_id: string;
          photographer_id: string;
          draft_type: "email" | "blog_post" | "instagram_caption" | "quote" | "anniversary_email";
          content: string;
          status?: "draft" | "approved" | "sent" | "published";
        };
        Update: {
          wedding_id?: string;
          photographer_id?: string;
          draft_type?: "email" | "blog_post" | "instagram_caption" | "quote" | "anniversary_email";
          content?: string;
          status?: "draft" | "approved" | "sent" | "published";
        };
        Relationships: [];
      };
      scheduled_jobs: {
        Row: {
          id: string;
          wedding_id: string;
          photographer_id: string;
          job_type: "anniversary_reminder" | "review_request" | "ig_publish" | "blog_draft";
          run_at: string;
          status: "pending" | "running" | "done" | "failed";
          payload: Json;
        };
        Insert: {
          wedding_id: string;
          photographer_id: string;
          job_type: "anniversary_reminder" | "review_request" | "ig_publish" | "blog_draft";
          run_at: string;
          status?: "pending" | "running" | "done" | "failed";
          payload?: Json;
        };
        Update: {
          wedding_id?: string;
          photographer_id?: string;
          job_type?: "anniversary_reminder" | "review_request" | "ig_publish" | "blog_draft";
          run_at?: string;
          status?: "pending" | "running" | "done" | "failed";
          payload?: Json;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          wedding_id: string;
          milestone_type: "anniversary_1yr" | "anniversary_5yr" | "anniversary_10yr";
          trigger_date: string;
          notified: boolean;
          notified_at: string | null;
        };
        Insert: {
          wedding_id: string;
          milestone_type: "anniversary_1yr" | "anniversary_5yr" | "anniversary_10yr";
          trigger_date: string;
          notified?: boolean;
          notified_at?: string | null;
        };
        Update: {
          wedding_id?: string;
          milestone_type?: "anniversary_1yr" | "anniversary_5yr" | "anniversary_10yr";
          trigger_date?: string;
          notified?: boolean;
          notified_at?: string | null;
        };
        Relationships: [];
      };
      ig_posts: {
        Row: {
          id: string;
          wedding_id: string;
          photographer_id: string;
          caption: string | null;
          hashtags: string | null;
          image_urls: string[] | null;
          status: "draft" | "scheduled" | "published" | "failed";
          scheduled_at: string | null;
          ig_media_id: string | null;
          created_at: string;
        };
        Insert: {
          wedding_id: string;
          photographer_id: string;
          caption?: string | null;
          hashtags?: string | null;
          image_urls?: string[] | null;
          status?: "draft" | "scheduled" | "published" | "failed";
          scheduled_at?: string | null;
          ig_media_id?: string | null;
        };
        Update: {
          wedding_id?: string;
          photographer_id?: string;
          caption?: string | null;
          hashtags?: string | null;
          image_urls?: string[] | null;
          status?: "draft" | "scheduled" | "published" | "failed";
          scheduled_at?: string | null;
          ig_media_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
