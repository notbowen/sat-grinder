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
      answer_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          response: string
          session_id: string
          user_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          id: string
          is_correct: boolean
          question_id: string
          response: string
          session_id: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          response?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_session_items: {
        Row: {
          first_attempt_correct: boolean | null
          position: number
          question_id: string
          resolved_at: string | null
          retry_count: number
          session_id: string
        }
        Insert: {
          first_attempt_correct?: boolean | null
          position: number
          question_id: string
          resolved_at?: string | null
          retry_count?: number
          session_id: string
        }
        Update: {
          first_attempt_correct?: boolean | null
          position?: number
          question_id?: string
          resolved_at?: string | null
          retry_count?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_session_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          abandoned_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          mode: string
          requested_count: number
          status: string
          topic_filters: string[]
          user_id: string
        }
        Insert: {
          abandoned_at?: string | null
          completed_at?: string | null
          created_at?: string
          id: string
          mode: string
          requested_count: number
          status?: string
          topic_filters?: string[]
          user_id: string
        }
        Update: {
          abandoned_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mode?: string
          requested_count?: number
          status?: string
          topic_filters?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_assets: {
        Row: {
          byte_size: number
          created_at: string
          id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          id: string
          mime_type: string
          storage_path: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: []
      }
      question_sync_staging: {
        Row: {
          answer_options: Json
          content_hash: string
          correct_answers: string[]
          difficulty: string
          display_id: string
          domain_code: string
          domain_name: string
          id: string
          is_active_test: boolean
          rationale_html: string
          run_id: string
          section: string
          skill_code: string
          skill_name: string
          source_updated_at: string | null
          stem_html: string
          stimulus_html: string | null
          type: string
        }
        Insert: {
          answer_options: Json
          content_hash: string
          correct_answers: string[]
          difficulty: string
          display_id: string
          domain_code: string
          domain_name: string
          id: string
          is_active_test?: boolean
          rationale_html: string
          run_id: string
          section: string
          skill_code: string
          skill_name: string
          source_updated_at?: string | null
          stem_html: string
          stimulus_html?: string | null
          type: string
        }
        Update: {
          answer_options?: Json
          content_hash?: string
          correct_answers?: string[]
          difficulty?: string
          display_id?: string
          domain_code?: string
          domain_name?: string
          id?: string
          is_active_test?: boolean
          rationale_html?: string
          run_id?: string
          section?: string
          skill_code?: string
          skill_name?: string
          source_updated_at?: string | null
          stem_html?: string
          stimulus_html?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_sync_staging_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_options: Json
          content_hash: string
          correct_answers: string[]
          created_at: string
          difficulty: string
          display_id: string
          domain_code: string
          domain_name: string
          id: string
          is_active_test: boolean
          is_retired: boolean
          rationale_html: string
          section: string
          skill_code: string
          skill_name: string
          source_updated_at: string | null
          stem_html: string
          stimulus_html: string | null
          sync_run_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          answer_options?: Json
          content_hash: string
          correct_answers: string[]
          created_at?: string
          difficulty: string
          display_id: string
          domain_code: string
          domain_name: string
          id: string
          is_active_test?: boolean
          is_retired?: boolean
          rationale_html: string
          section: string
          skill_code: string
          skill_name: string
          source_updated_at?: string | null
          stem_html: string
          stimulus_html?: string | null
          sync_run_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          answer_options?: Json
          content_hash?: string
          correct_answers?: string[]
          created_at?: string
          difficulty?: string
          display_id?: string
          domain_code?: string
          domain_name?: string
          id?: string
          is_active_test?: boolean
          is_retired?: boolean
          rationale_html?: string
          section?: string
          skill_code?: string
          skill_name?: string
          source_updated_at?: string | null
          stem_html?: string
          stimulus_html?: string | null
          sync_run_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          active_excluded: number
          completed_at: string | null
          error: string | null
          fetched_details: number
          id: string
          imported: number
          started_at: string
          status: string
          total_metadata: number
          trigger_source: string
        }
        Insert: {
          active_excluded?: number
          completed_at?: string | null
          error?: string | null
          fetched_details?: number
          id: string
          imported?: number
          started_at: string
          status: string
          total_metadata?: number
          trigger_source: string
        }
        Update: {
          active_excluded?: number
          completed_at?: string | null
          error?: string | null
          fetched_details?: number
          id?: string
          imported?: number
          started_at?: string
          status?: string
          total_metadata?: number
          trigger_source?: string
        }
        Relationships: []
      }
      user_question_progress: {
        Row: {
          first_attempt_misses: number
          last_answered_at: string
          mastered_at: string | null
          question_id: string
          status: string
          user_id: string
        }
        Insert: {
          first_attempt_misses?: number
          last_answered_at: string
          mastered_at?: string | null
          question_id: string
          status: string
          user_id: string
        }
        Update: {
          first_attempt_misses?: number
          last_answered_at?: string
          mastered_at?: string | null
          question_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_progress_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_practice_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      begin_question_sync: {
        Args: { p_trigger_source?: string }
        Returns: string
      }
      fail_question_sync: {
        Args: { p_error: string; p_run_id: string }
        Returns: undefined
      }
      finalize_question_sync: { Args: { p_run_id: string }; Returns: Json }
      get_dashboard: { Args: never; Returns: Json }
      get_practice_pool: { Args: never; Returns: Json }
      get_practice_session: { Args: { p_session_id: string }; Returns: Json }
      start_practice: {
        Args: { p_count: number; p_filters?: string[]; p_mode: string }
        Returns: string
      }
      submit_practice_answer: {
        Args: {
          p_question_id: string
          p_response: string
          p_session_id: string
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
    Enums: {},
  },
} as const

