import { supabase } from './src/lib/supabaseClient.js';

const run = async () => {
    // try to fetch 1 row
    const { data } = await supabase.from('attendance').select('*').limit(1);
    console.log('Sample row:', data[0]);

    if (data && data[0]) {
        const id = data[0].id;
        const { error } = await supabase.from('attendance').update({ timestamp: new Date().toISOString() }).eq('id', id);
        console.log('Update result:', error ? error.message : 'Success');
    }
};

run().catch(console.error);
