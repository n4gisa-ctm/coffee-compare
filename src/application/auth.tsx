/**
 * 認証状態の管理。Supabase未設定時は enabled=false（ゲストのみ）。
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, cloudEnabled } from '../infrastructure/supabase';

export interface AuthApi {
  /** クラウド機能が構成されているか（環境変数の有無） */
  enabled: boolean;
  /** 認証状態の初期読込が終わったか */
  ready: boolean;
  session: Session | null;
  email: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider の外で useAuth が呼ばれました');
  return ctx;
}

/** Supabaseのエラーメッセージを日本語にする */
function toJaMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが違います。';
  if (m.includes('user already registered')) return 'このメールアドレスは登録済みです。ログインしてください。';
  if (m.includes('password should be at least')) return 'パスワードは6文字以上にしてください。';
  if (m.includes('email not confirmed')) return 'メールの確認が済んでいません。届いた確認メールのリンクを開いてください。';
  if (m.includes('rate limit') || m.includes('too many')) return '試行回数が多すぎます。しばらく待ってからお試しください。';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'メールアドレスの形式が正しくありません。';
  return `認証に失敗しました：${message}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      enabled: cloudEnabled,
      ready,
      session,
      email: session?.user.email ?? null,

      async signInWithPassword(email, password) {
        if (!supabase) throw new Error('クラウド機能が構成されていません');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(toJaMessage(error.message));
      },

      async signUpWithPassword(email, password) {
        if (!supabase) throw new Error('クラウド機能が構成されていません');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(toJaMessage(error.message));
        // メール確認が有効な場合、この時点ではセッションが無い
        return data.session ? 'signed-in' : 'confirm-email';
      },

      async signInWithGoogle() {
        if (!supabase) throw new Error('クラウド機能が構成されていません');
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw new Error(toJaMessage(error.message));
      },

      async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(toJaMessage(error.message));
      },
    }),
    [ready, session],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
