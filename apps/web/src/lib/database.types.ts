
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "deadlines": {
                  Row: {
                    "category": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"done_at": string | null,"due_date": string,"household_id": string,"id": string,"note": string | null,"notify_days": (number)[],"recurrence": Json | null,"start_date": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "category"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"done_at"?: string | null,"due_date": string,"household_id": string,"id"?: string,"note"?: string | null,"notify_days"?: (number)[],"recurrence"?: Json | null,"start_date": string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"done_at"?: string | null,"due_date"?: string,"household_id"?: string,"id"?: string,"note"?: string | null,"notify_days"?: (number)[],"recurrence"?: Json | null,"start_date"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "deadlines_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"device_pairings": {
                  Row: {
                    "code": string,"expires_at": string,"user_id": string
                  }
                  Insert: {
                    "code": string,"expires_at"?: string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"expires_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"devices": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"last_seen_at": string | null,"name": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"household_id": string,"token": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"household_id": string,"token"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"household_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "display_name": string | null,"household_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "display_name"?: string | null,"household_id": string,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "display_name"?: string | null,"household_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"night_end": string,"night_start": string,"timezone": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"night_end"?: string,"night_start"?: string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"night_end"?: string,"night_start"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminders": {
                  Row: {
                    "at_time": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"household_id": string,"id": string,"next_at": string | null,"note": string | null,"recurrence": Json | null,"start_date": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "at_time": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"household_id": string,"id"?: string,"next_at"?: string | null,"note"?: string | null,"recurrence"?: Json | null,"start_date": string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "at_time"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"household_id"?: string,"id"?: string,"next_at"?: string | null,"note"?: string | null,"recurrence"?: Json | null,"start_date"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_item_stats": {
                  Row: {
                    "category": string,"household_id": string,"last_used": string,"name": string,"name_norm": string,"uses": number
                  }
                  Insert: {
                    "category": string,"household_id": string,"last_used"?: string,"name": string,"name_norm": string,"uses"?: number
                  }
                  Update: {
                    "category"?: string,"household_id"?: string,"last_used"?: string,"name"?: string,"name_norm"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_item_stats_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_items": {
                  Row: {
                    "category": string,"checked": boolean,"created_at": string,"created_by": string | null,"deleted_at": string | null,"household_id": string,"id": string,"name": string,"position": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "category"?: string,"checked"?: boolean,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"household_id": string,"id"?: string,"name": string,"position"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"checked"?: boolean,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "invite": string }; Returns: string
                           },
"can_read":
{ Args: { "hid": string }; Returns: boolean
                           },
"claim_pairing":
{ Args: { "code": string,"household": string,"name"?: string }; Returns: string
                           },
"complete_deadline":
{ Args: { "deadline": string,"next_due"?: string }; Returns: string
                           },
"create_household":
{ Args: { "name": string }; Returns: string
                           },
"default_display_name":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"device_heartbeat":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"is_member":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_real_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"start_pairing":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"valid_recurrence":
{ Args: { "freqs": (string)[],"r": Json }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

