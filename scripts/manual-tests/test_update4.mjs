const apiUrl = 'https://buboccerdvmzrrjbyqxa.supabase.co';
const apiKey = process.env.VITE_SUPABASE_ANON_KEY;
fetch(apiUrl + '/rest/v1/attendance?select=id&limit=1', {
  headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey }
}).then(r => r.json()).then(d => {     
  if (d && d[0]) {
    fetch(apiUrl + '/rest/v1/attendance?id=eq.' + d[0].id, {
      method: 'PATCH',
      headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ status: 'Late' })
    }).then(async r => {
       const text = await r.text();
       console.log('Update result status:', r.status);
       console.log('Update body:', text);
    }).catch(console.error);
  }
}).catch(console.error);
