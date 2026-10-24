import { getApiBaseUrl } from "@/lib/api-url"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("civicvision_token")
}

export async function getReports() {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(`${getApiBaseUrl()}/reports`, {
    headers,
  })

  if (!response.ok) {
    throw new Error("Failed to fetch reports")
  }

  return response.json()
}

export async function getAllReports() {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(`${getApiBaseUrl()}/reports/all`, {
    headers,
  })

  if (!response.ok) {
    throw new Error("Failed to fetch reports")
  }

  return response.json()
}

export async function predictComplaint(image: File) {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const formData = new FormData()

  formData.append("image", image)

  const response = await fetch(`${getApiBaseUrl()}/predict`, {
    method: "POST",
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Prediction API error:", errorText)
    throw new Error("Failed to analyze image")
  }

  return response.json()
}

export async function submitComplaint(
  reportId: string,
  latitude: number | null,
  longitude: number | null,
  description: string
) {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(
    `${getApiBaseUrl()}/reports/${reportId}/submit`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        latitude,
        longitude,
        description: description.trim() || null,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Submit complaint API error:", errorText)
    throw new Error("Failed to submit complaint")
  }

  return response.json()
}

export async function getReport(reportId: string) {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(
    `${getApiBaseUrl()}/reports/${reportId}`,
    { headers }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch complaint")
  }

  return response.json()
}

export async function updateReportStatus(
  reportId: string,
  status: string
) {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(
    `${getApiBaseUrl()}/reports/${reportId}/status`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Status update API error:", errorText)
    throw new Error("Failed to update complaint status")
  }

  return response.json()
}
