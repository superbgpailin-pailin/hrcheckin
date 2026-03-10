const apiUrl = 'https://buboccerdvmzrrjbyqxa.supabase.co';
const apiKey = process.env.VITE_SUPABASE_ANON_KEY;
if(!apiKey) { console.error('No VITE_SUPABASE_ANON_KEY env var set for node'); process.exit(1); }

fetch(apiUrl + '/rest/v1/attendance?select=id,status,type&order=timestamp.desc&limit=5', {
  headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey }
}).then(r => r.json()).then(d => console.log('Top 5 rows:', d)).catch(console.error);
