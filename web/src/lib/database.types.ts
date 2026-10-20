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
    PostgrestVersion: "14.18"
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
      clubs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          club_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          pars: number[]
          si: number[]
        }
        Insert: {
          club_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          pars: number[]
          si: number[]
        }
        Update: {
          club_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          pars?: number[]
          si?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "courses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          alternate: boolean
          created_at: string
          deleted_at: string | null
          event_id: string
          golfer_id: string
          id: string
          index_used: number
          nh: boolean
          tee_id: string | null
        }
        Insert: {
          alternate?: boolean
          created_at?: string
          deleted_at?: string | null
          event_id: string
          golfer_id: string
          id?: string
          index_used: number
          nh?: boolean
          tee_id?: string | null
        }
        Update: {
          alternate?: boolean
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          golfer_id?: string
          id?: string
          index_used?: number
          nh?: boolean
          tee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_golfer_id_fkey"
            columns: ["golfer_id"]
            isOneToOne: false
            referencedRelation: "golfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_tee_id_fkey"
            columns: ["tee_id"]
            isOneToOne: false
            referencedRelation: "tees"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          club_id: string
          course_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          settings: Json
          status: string
        }
        Insert: {
          club_id: string
          course_id?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          settings?: Json
          status?: string
        }
        Update: {
          club_id?: string
          course_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          settings?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      golfers: {
        Row: {
          club_id: string
          created_at: string
          deleted_at: string | null
          ghin_number: string | null
          id: string
          index: number | null
          name: string
          nh: boolean
        }
        Insert: {
          club_id: string
          created_at?: string
          deleted_at?: string | null
          ghin_number?: string | null
          id?: string
          index?: number | null
          name: string
          nh?: boolean
        }
        Update: {
          club_id?: string
          created_at?: string
          deleted_at?: string | null
          ghin_number?: string | null
          id?: string
          index?: number | null
          name?: string
          nh?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "golfers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      group_teams: {
        Row: {
          created_at: string
          group_id: string
          sort: number
          team_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          sort?: number
          team_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          sort?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          round_id: string
          sort: number
          start_hole: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          round_id: string
          sort?: number
          start_hole?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          round_id?: string
          sort?: number
          start_hole?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          event_id: string
          id: string
          mode: string
          number: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          mode?: string
          number: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          mode?: string
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      score_log: {
        Row: {
          at: string
          entry_id: string | null
          hole: number
          id: number
          new: number | null
          old: number | null
          round_id: string
          screen: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          at?: string
          entry_id?: string | null
          hole: number
          id?: never
          new?: number | null
          old?: number | null
          round_id: string
          screen?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          at?: string
          entry_id?: string | null
          hole?: number
          id?: never
          new?: number | null
          old?: number | null
          round_id?: string
          screen?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_log_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_log_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          created_at: string
          entry_id: string | null
          gross: number | null
          hole: number
          id: string
          round_id: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          entry_id?: string | null
          gross?: number | null
          hole: number
          id?: string
          round_id: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          entry_id?: string | null
          gross?: number | null
          hole?: number
          id?: string
          round_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          club_id: string
          created_at: string
          email: string
          id: string
          invited_at: string
          removed_at: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          removed_at?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          removed_at?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          entry_id: string
          sort: number
          team_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          sort?: number
          team_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          sort?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_id: string
          flight: number | null
          id: string
          label: string
          sort: number
          status: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_id: string
          flight?: number | null
          id?: string
          label: string
          sort?: number
          status?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          flight?: number | null
          id?: string
          label?: string
          sort?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tees: {
        Row: {
          course_id: string
          created_at: string
          id: string
          name: string
          pars: number[] | null
          rating: number
          si: number[] | null
          slope: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          name: string
          pars?: number[] | null
          rating: number
          si?: number[] | null
          slope: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          pars?: number[] | null
          rating?: number
          si?: number[] | null
          slope?: number
        }
        Relationships: [
          {
            foreignKeyName: "tees_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_club: { Args: { name: string }; Returns: string }
      is_pro: { Args: { club: string }; Returns: boolean }
      my_club_ids: { Args: never; Returns: string[] }
      save_score: {
        Args: {
          p_gross: number
          p_hole: number
          p_round: string
          p_screen: string
          p_team: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
} as const
