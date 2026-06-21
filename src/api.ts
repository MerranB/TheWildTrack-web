const API_BASE_URL = import.meta.env.PROD
  ? 'https://api.thewildtrack.org' : '';

export function apiUrl(path: string) {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}