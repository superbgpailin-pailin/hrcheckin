const apiUrl = 'https://buboccerdvmzrrjbyqxa.supabase.co';
const apiKey = process.env.VITE_SUPABASE_ANON_KEY;
fetch(apiUrl + '/rest/v1/attendance?select=id,status,type&order=timestamp.desc&limit=5&or=%28type.neq.check_out%2Ctype.is.null%29', {
  headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey }
}).then(r => r.json()).then(d => console.log('Top 5 rows with OR:', d)).catch(console.error);
