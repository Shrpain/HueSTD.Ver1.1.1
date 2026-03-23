/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oubkbvypiabgfulnhsnd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmtidnlwaWFiZ2Z1bG5oc25kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMwMzYsImV4cCI6MjA4NTE3OTAzNn0.iibCCC5PfRnNAuYGsh2s5O-V5vbfFpAB-QCBo1E0-s0';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export async function syncSupabaseRealtimeAuth(token: string | null | undefined) {
  try {
    await supabase.realtime.setAuth(token || null);
  } catch (error) {
    console.warn('[Supabase] realtime.setAuth failed:', error);
  }
}
