import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { forgotPassword } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)

  // If already logged in, redirect to dashboard
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    setIsSubmitting(true)
    try {
      await login(username, password)
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Invalid credentials. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.')
      return
    }

    setForgotSubmitting(true)
    try {
      const res = await forgotPassword(forgotEmail)
      setForgotSuccess(res.data.message || 'Password reset instructions sent to your email.')
    } catch (err) {
      const data = err.response?.data
      if (data?.email) {
        setForgotError(Array.isArray(data.email) ? data.email[0] : data.email)
      } else {
        setForgotError(data?.detail || 'Something went wrong. Please try again.')
      }
    } finally {
      setForgotSubmitting(false)
    }
  }

  // ── Forgot Password Form ──────────────────────────────
  if (showForgot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(0,0,0,0.02)_1px,_transparent_1px)] bg-[length:24px_24px]" />

        <Card className="relative w-full max-w-[400px] shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
              <span className="text-xl font-bold text-primary-foreground">Δ</span>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Reset Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your email to receive reset instructions
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {/* Success Message */}
              {forgotSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* Error Message */}
              {forgotError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="forgot-email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                  disabled={forgotSubmitting}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={forgotSubmitting}
              >
                {forgotSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => { setShowForgot(false); setForgotEmail(''); setForgotError(''); setForgotSuccess(''); }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Login Form ─────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(0,0,0,0.02)_1px,_transparent_1px)] bg-[length:24px_24px]" />

      <Card className="relative w-full max-w-[400px] shadow-lg">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
            <span className="text-xl font-bold text-primary-foreground">Δ</span>
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            DeltaPLM
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Product Lifecycle Management
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                {/* <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Forget Password?
                </button> */}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
