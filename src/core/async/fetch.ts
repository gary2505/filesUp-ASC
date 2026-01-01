export async function fetchJson<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { ...init, signal });
  const isHttp = true;
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.isHttp = isHttp; 
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}
