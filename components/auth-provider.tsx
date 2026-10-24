"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, getToken, getUser, setToken, setUser, removeToken, removeUser, getMe } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const token = getToken()
        const storedUser = getUser()
        if (token && storedUser) {
          setUserState(storedUser)
          // Optionally verify token
          try {
            await getMe()
          } catch {
            logout()
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const login = (token: string, user: User) => {
    setToken(token)
    setUser(user)
    setUserState(user)
  }

  const logout = () => {
    removeToken()
    removeUser()
    setUserState(null)
  }

  const refreshUser = async () => {
    try {
      const res = await getMe()
      setUser(res.user)
      setUserState(res.user)
      setUser(res.user)
    } catch (e) {
      logout()
      throw e
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
