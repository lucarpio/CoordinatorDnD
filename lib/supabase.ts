import { createClient } from "@supabase/supabase-js";

export type AvailabilityMap = Record<string, string[]>;

export interface Poll {
  id: string;
  slug: string;
  title: string;
  year: number;
  month: number; // 1 - 12
  participants: string[];
  availability: AvailabilityMap;
  created_at: string;
  updated_at: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      polls: {
        Row: {
          id: string;
          slug: string;
          title: string;
          year: number;
          month: number;
          participants: string[];
          availability: AvailabilityMap;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          year: number;
          month: number;
          participants: string[];
          availability?: AvailabilityMap;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          year?: number;
          month?: number;
          participants?: string[];
          availability?: AvailabilityMap;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
