import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://lyvrrtnhjkjhqhbarngp.supabase.co', 'sb_publishable_6opa3TTDKhGmmjWL0OIZRw_9QvpIdZA');

async function debug() {
    console.log('Buscando últimos testes realizados...');
    const { data, error } = await supabase.from('testes_realizados').select('*').order('created_at', { ascending: false }).limit(2);
    if(error) {
       console.error(error);
       return;
    }
    console.log(JSON.stringify(data, null, 2));
}

debug();
