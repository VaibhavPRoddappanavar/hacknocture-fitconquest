const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
async function check() {
  const r = await fetch('http://localhost:8080/api/activities?days=3&limit=5', {headers: {'ngrok-skip-browser-warning': 'true'}});
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2));
}
check();
