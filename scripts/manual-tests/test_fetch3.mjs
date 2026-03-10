const apiUrl = 'https://buboccerdvmzrrjbyqxa.supabase.co';
const apiKey = process.env.VITE_SUPABASE_ANON_KEY;
fetch(apiUrl + '/rest/v1/attendance?select=id,photo_url,created_at&order=timestamp.desc&limit=5', {
  headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey }
}).then(r => r.json()).then(d => console.log('Top 5 rows with photo:', d)).catch(console.error);
