import { getApiBaseUrl } from "@/lib/api-url"

export interface User {
  user_id: string
  name: string
  email: string
  role: "citizen" | "municipal_officer"
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("civicvision_token")
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("civicvision_token", token)
  }
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("civicvision_token")
  }
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null
  const userStr = localStorage.getItem("civicvision_user")
  return userStr ? JSON.parse(userStr) : null
}

export function setUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("civicvision_user", JSON.stringify(user))
  }
}

export function removeUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("civicvision_user")
  }
}

export function logout(): void {
  removeToken()
  removeUser()
}

export async function register(name: string, email: string, password: string): Promise<any> {
  const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Registration failed" }))
    throw new Error(error.detail || "Registration failed")
  }
  return response.json()
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Login failed" }))
    throw new Error(error.detail || "Login failed")
  }
  return response.json()
}

export async function getMe(): Promise<{ user: User }> {
  const token = getToken()
  if (!token) throw new Error("No token")
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new Error("Failed to get user")
  }
  return response.json()
}
