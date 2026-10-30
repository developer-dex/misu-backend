// Render's free plan puts the service to sleep after 15 minutes without a request.
// Calling our own public address every 10 minutes counts as a request, so it stays awake.
const EVERY_MS = 10 * 60 * 1000;

export function startKeepAlive(baseUrl: string) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/health`;

  const ping = async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) console.warn(`Keep-alive: ${url} answered ${res.status}`);
    } catch (err) {
      console.warn(`Keep-alive: could not reach ${url}:`, err instanceof Error ? err.message : err);
    }
  };

  setInterval(ping, EVERY_MS).unref();
  console.log(`Keep-alive: pinging ${url} every ${EVERY_MS / 60000} minutes`);
}
