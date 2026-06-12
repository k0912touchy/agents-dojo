export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      waitlist: {
        Row: { id: string; email: string; agent_type: string | null; created_at: string }
        Insert: { id?: string; email: string; agent_type?: string | null; created_at?: string }
        Update: { id?: string; email?: string; agent_type?: string | null }
      }
      agents: {
        Row: {
          id: string; user_id: string; name: string; persona: string | null
          system_prompt: string | null; skills: Json; params: AgentParams
          level: number; total_tokens: number; is_public: boolean
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; user_id: string; name: string; persona?: string | null
          system_prompt?: string | null; skills?: Json; params?: AgentParams
          level?: number; total_tokens?: number; is_public?: boolean
        }
        Update: {
          name?: string; persona?: string | null; system_prompt?: string | null
          skills?: Json; params?: AgentParams; level?: number
          total_tokens?: number; is_public?: boolean; updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string; user_id: string; agent_id: string; mode: string
          tokens_used: number; messages: Json; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; user_id: string; agent_id: string; mode?: string
          tokens_used?: number; messages?: Json
        }
        Update: { tokens_used?: number; messages?: Json; updated_at?: string }
      }
      credits: {
        Row: { id: string; user_id: string; balance: number; plan: string; updated_at: string }
        Insert: { id?: string; user_id: string; balance?: number; plan?: string }
        Update: { balance?: number; plan?: string; updated_at?: string }
      }
    }
  }
}

export interface AgentParams {
  expertise: number
  empathy: number
  analysis: number
  execution: number
  creativity: number
}
