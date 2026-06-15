export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_challenges: {
        Row: {
          created_at: string
          day: string
          figure_ids: string[]
        }
        Insert: {
          created_at?: string
          day: string
          figure_ids: string[]
        }
        Update: {
          created_at?: string
          day?: string
          figure_ids?: string[]
        }
        Relationships: []
      }
      play_events: {
        Row: {
          created_at: string
          day: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          correct_ever: boolean
          created_at: string
          daily_streak: number
          id: string
          last_daily_played_on: string | null
          nickname: string | null
          personal_best: number
          scholar_win_streak: number
          total_games: number
          unlocked_achievements: string[]
          updated_at: string
          xp: number
        }
        Insert: {
          correct_ever?: boolean
          created_at?: string
          daily_streak?: number
          id: string
          last_daily_played_on?: string | null
          nickname?: string | null
          personal_best?: number
          scholar_win_streak?: number
          total_games?: number
          unlocked_achievements?: string[]
          updated_at?: string
          xp?: number
        }
        Update: {
          correct_ever?: boolean
          created_at?: string
          daily_streak?: number
          id?: string
          last_daily_played_on?: string | null
          nickname?: string | null
          personal_best?: number
          scholar_win_streak?: number
          total_games?: number
          unlocked_achievements?: string[]
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      runs: {
        Row: {
          achievements: string[]
          categories: string[]
          created_at: string
          daily_date: string | null
          difficulty: string
          id: string
          level_name: string | null
          mode: string
          results: Json
          score: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          achievements?: string[]
          categories?: string[]
          created_at?: string
          daily_date?: string | null
          difficulty: string
          id?: string
          level_name?: string | null
          mode?: string
          results: Json
          score: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          achievements?: string[]
          categories?: string[]
          created_at?: string
          daily_date?: string | null
          difficulty?: string
          id?: string
          level_name?: string | null
          mode?: string
          results?: Json
          score?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_winners: {
        Row: {
          created_at: string
          week_start: string
          winners: Json
        }
        Insert: {
          created_at?: string
          week_start: string
          winners: Json
        }
        Update: {
          created_at?: string
          week_start?: string
          winners?: Json
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      archive_week: { Args: { p_week_start?: string }; Returns: Json }
      claim_nickname: { Args: { p_nickname: string }; Returns: Json }
      current_week_start: { Args: never; Returns: string }
      daily_leaderboard: {
        Args: {
          p_daily_date: string
          p_difficulty?: string
          p_limit?: number
        }
        Returns: Json
      }
      daily_percentile: {
        Args: {
          p_daily_date: string
          p_score: number
        }
        Returns: number
      }
      get_public_profile: { Args: { p_nickname: string }; Returns: Json }
      hall_of_fame: { Args: { p_limit?: number }; Returns: Json }
      players_today: { Args: never; Returns: number }
      submit_run: {
        Args: {
          p_achievements?: string[]
          p_categories: string[]
          p_daily_date?: string
          p_difficulty: string
          p_level_name?: string
          p_mode?: string
          p_results: Json
          p_session_id: string
        }
        Returns: Json
      }
      top_leaderboard: {
        Args: {
          p_difficulty?: string
          p_limit?: number
        }
        Returns: Json
      }
      weekly_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          achievements: string[]
          best_score: number
          difficulty: string
          games_played: number
          level_name: string
          nickname: string
          played_at: string
          rank: number
        }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
