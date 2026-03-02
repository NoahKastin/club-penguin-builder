// Retry fetch on 503 (server starting up) with exponential backoff
export default async function fetchRetry(url, options = {}, maxRetries = 5) {
  for (let i = 0; i <= maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 503) return res;
    if (i < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // 1s, 2s, 4s, 8s, 16s
    }
  }
  return fetch(url, options); // Final attempt, return whatever happens
}
