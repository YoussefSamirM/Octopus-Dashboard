import { createClient } from '@supabase/supabase-js';

// Leave placeholders for the URL and Anon Key as requested.
// The user should set these in their .env file (e.g. VITE_SUPABASE_URL)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
