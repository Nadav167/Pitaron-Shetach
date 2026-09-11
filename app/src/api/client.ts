import { Site } from "@/types/site";

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
  getSites: () => request<Site[]>("/sites"),
  getSiteById: (id: string) => request<Site>(`/sites/${id}`),
};

export { ApiError };
