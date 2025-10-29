/**
 * User data with dynamic fields based on enabled plugins
 */
export type UserInsertData = {
  id: string;
  email: string | null;
  name: string;
  emailVerified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  image?: string;
  [key: string]: any; // Allow dynamic plugin fields
};

/**
 * Account data structure for bulk insert
 */
export type AccountInsertData = {
  id: string;
  userId: string;
  providerId: string;
  accountId: string;
  password: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/**
 * Supabase `auth.identities` table schema
 */
type SupabaseIdentityFromDB = {
  /**
   * uuid NOT NULL
   */
  id: string;
  /**
   * text NOT NULL
   */
  provider_id: string;
  /**
   * uuid NOT NULL
   */
  user_id: string;
  /**
   * jsonb NOT NULL
   */
  identity_data: Record<string, any>;
  /**
   * text NOT NULL
   */
  provider: string;
  /**
   * timestamp with time zone
   */
  last_sign_in_at: string | null;
  /**
   * timestamp with time zone
   */
  created_at: string | null;
  /**
   * timestamp with time zone
   */
  updated_at: string | null;
  /**
   * text (computed column)
   */
  email: string | null;
};

/**
 * Supabase `auth.users` table schema
 */
export type SupabaseUserFromDB = {
  /**
   * uuid
   */
  instance_id: string | null;
  /**
   * uuid NOT NULL
   */
  id: string;
  /**
   * character varying
   */
  aud: string | null;
  /**
   * character varying
   */
  role: string | null;
  /**
   * character varying
   */
  email: string | null;
  /**
   * character varying
   */
  encrypted_password: string | null;
  /**
   * timestamp with time zone
   */
  email_confirmed_at: string | null;
  /**
   * timestamp with time zone
   */
  invited_at: string | null;
  /**
   * character varying
   */
  confirmation_token: string | null;
  /**
   * timestamp with time zone
   */
  confirmation_sent_at: string | null;
  /**
   * character varying
   */
  recovery_token: string | null;
  /**
   * timestamp with time zone
   */
  recovery_sent_at: string | null;
  /**
   * character varying
   */
  email_change_token_new: string | null;
  /**
   * character varying
   */
  email_change: string | null;
  /**
   * timestamp with time zone
   */
  email_change_sent_at: string | null;
  /**
   * timestamp with time zone
   */
  last_sign_in_at: string | null;
  /**
   * jsonb
   */
  raw_app_meta_data: Record<string, any> | null;
  /**
   * jsonb
   */
  raw_user_meta_data: Record<string, any> | null;
  /**
   * boolean
   */
  is_super_admin: boolean | null;
  /**
   * timestamp with time zone
   */
  created_at: string | null;
  /**
   * timestamp with time zone
   */
  updated_at: string | null;
  /**
   * text UNIQUE
   */
  phone: string | null;
  /**
   * timestamp with time zone
   */
  phone_confirmed_at: string | null;
  /**
   * text DEFAULT ''
   */
  phone_change: string | null;
  /**
   * character varying DEFAULT ''
   */
  phone_change_token: string | null;
  /**
   * timestamp with time zone
   */
  phone_change_sent_at: string | null;
  /**
   * timestamp with time zone (computed)
   */
  confirmed_at: string | null;
  /**
   * character varying DEFAULT ''
   */
  email_change_token_current: string | null;
  /**
   * smallint DEFAULT 0
   */
  email_change_confirm_status: number | null;
  /**
   * timestamp with time zone
   */
  banned_until: string | null;
  /**
   * character varying DEFAULT ''
   */
  reauthentication_token: string | null;
  /**
   * timestamp with time zone
   */
  reauthentication_sent_at: string | null;
  /**
   * boolean NOT NULL DEFAULT false
   */
  is_sso_user: boolean;
  /**
   * timestamp with time zone
   */
  deleted_at: string | null;
  /**
   * boolean NOT NULL DEFAULT false
   */
  is_anonymous: boolean;
  /**
   * JOIN result from `auth.identities`
   */
  identities: SupabaseIdentityFromDB[];
};
