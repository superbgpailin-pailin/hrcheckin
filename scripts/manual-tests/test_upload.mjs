import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://buboccerdvmzrrjbyqxa.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseKey) { console.error('No key'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

const run = async () => {
    // try to fetch column names for attendance table
    const { data: cols, error: colError } = await supabase.rpc('get_columns', { table_name: 'attendance' }).catch(() => ({ error: 'rpc not found' }));
    
    // just fetch a row and look at keys
    const { data, error } = await supabase.from('attendance').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns in attendance:', Object.keys(data[0]));
    }
    
    // test upload to see what happens
    const content = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 43, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    const blob = new Blob([content], { type: 'image/png' });
    const path = checkin/TEST/.png;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(path, blob, { contentType: 'image/png' });

    if (uploadError) {
        console.error('Storage Upload Error Details:', uploadError);
    } else {
        console.log('Storage Upload Success:', uploadData);
    }
};

run().catch(console.error);
