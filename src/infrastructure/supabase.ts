/**
 * Supabase クライアント。
 * 環境変数（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）が未設定の場合は
 * クラウド機能を無効にし、ゲスト（端末内保存）モードのみで動作する。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const cloudEnabled = supabase !== null;
