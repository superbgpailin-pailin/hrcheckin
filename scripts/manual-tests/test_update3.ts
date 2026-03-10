import { supabase } from './src/lib/supabaseClient.ts';

const run = async () => {
    const { data } = await supabase.from('attendance').select('id').limit(1);
    if (data && data.length > 0) {
        const id = data[0].id;
        console.log('Testing with ID:', id);
        
        const { error: updateError } = await supabase.from('attendance').update({ status: 'Late' }).eq('id', id);
        console.log('Update error:', updateError);
        
        const { error: deleteError } = await supabase.from('attendance').delete().eq('id', id);
        console.log('Delete error:', deleteError);
    } else {
        console.log('No attendance data to test.');
    }
};

run().catch(console.error);
