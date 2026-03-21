import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, getMe } from '@/api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // On mount, check if tokens exist and restore session
  useEffect(() => {
    const restoreSession = async () => {
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        setIsLoading(false)
        return
      }

      try {
        const { data } = await getMe()
        setUser(data)
      } catch {
        // Token expired or invalid — clear everything
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await loginUser({ username, password })

    // Store tokens
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)

    // Fetch user profile
    const { data: userData } = await getMe()
    setUser(userData)

    // Navigate to dashboard
    navigate('/', { replace: true })
  }, [navigate])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const hasRole = useCallback((roles) => {
    if (!user) return false
    if (typeof roles === 'string') return user.role === roles
    return roles.includes(user.role)
  }, [user])

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
