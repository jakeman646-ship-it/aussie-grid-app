import type { Session, User } from "@supabase/supabase-js";

export type AuthSession = Session;
export type AuthUser = User;

export interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
