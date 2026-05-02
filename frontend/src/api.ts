const BASE = import.meta.env.VITE_API_URL ?? '';

const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const request = async (method: string, path: string, body?: any) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? 'Erro inesperado.');
  }

  return data;
};

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body),
};
