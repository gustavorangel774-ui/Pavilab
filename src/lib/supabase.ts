import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lyvrrtnhjkjhqhbarngp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_6opa3TTDKhGmmjWL0OIZRw_9QvpIdZA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
