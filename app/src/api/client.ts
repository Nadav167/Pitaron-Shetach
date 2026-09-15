import type { Campsite } from "@/types/campsite";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new ApiError("EXPO_PUBLIC_API_URL is not configured");
  }
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed`, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  getCampsites: () => request<Campsite[]>("/sites"),
  getCampsiteById: (id: string) => request<Campsite>(`/sites/${id}`),
  /** @deprecated Prefer the campsite-named methods. */
  getSites: () => request<Campsite[]>("/sites"),
  /** @deprecated Prefer the campsite-named methods. */
  getSiteById: (id: string) => request<Campsite>(`/sites/${id}`),
};

export { ApiError };
