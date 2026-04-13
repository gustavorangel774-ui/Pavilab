import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://lyvrrtnhjkjhqhbarngp.supabase.co', 'sb_publishable_6opa3TTDKhGmmjWL0OIZRw_9QvpIdZA');

async function run() {
    console.log("No raw sql available through anon key, skipping DDL.");
}
run();
