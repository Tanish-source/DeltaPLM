import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { registerUser } from '@/api/auth'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function Signup() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

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

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    setApiError('')
  }

  const validate = () => {
    const newErrors = {}

    if (!form.username.trim()) {
      newErrors.username = 'Login ID is required.'
    } else if (form.username.length < 6 || form.username.length > 12) {
      newErrors.username = 'Login ID must be between 6 and 12 characters.'
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address.'
    }

    if (!form.password) {
      newErrors.password = 'Password is required.'
    } else {
      if (form.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters.'
      } else if (!/[a-z]/.test(form.password)) {
        newErrors.password = 'Password must contain at least one lowercase letter.'
      } else if (!/[A-Z]/.test(form.password)) {
        newErrors.password = 'Password must contain at least one uppercase letter.'
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.password)) {
        newErrors.password = 'Password must contain at least one special character.'
      }
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.'
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')

    if (!validate()) return

    setIsSubmitting(true)
    try {
      await registerUser({
        username: form.username,
        email: form.email,
        password: form.password,
        password2: form.confirmPassword,
      })
      setIsSuccess(true)
    } catch (err) {
      const data = err.response?.data
      if (data) {
        // Handle field-specific errors from Django
        const fieldErrors = {}
        if (data.username) fieldErrors.username = Array.isArray(data.username) ? data.username[0] : data.username
        if (data.email) fieldErrors.email = Array.isArray(data.email) ? data.email[0] : data.email
        if (data.password) fieldErrors.password = Array.isArray(data.password) ? data.password[0] : data.password

        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors)
        } else {
          setApiError(data.detail || data.non_field_errors?.[0] || 'Registration failed. Please try again.')
        }
      } else {
        setApiError('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success State ─────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(0,0,0,0.02)_1px,_transparent_1px)] bg-[length:24px_24px]" />

        <Card className="relative w-full max-w-[400px] shadow-lg">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Account Created!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your account has been created successfully. Your role will be
              assigned by an administrator. You can now sign in.
            </p>
            <Link to="/login" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
              Back to Login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Sign Up Form ──────────────────────────────────────
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
            Create Account
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign up for DeltaPLM
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* API Error */}
            {apiError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium">
                Login ID <span className="text-xs text-muted-foreground">(6-12 characters)</span>
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="6-12 characters"
                value={form.username}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="username"
                autoFocus
                className={errors.username ? 'border-destructive' : ''}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="email"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Min 8 chars, upper+lower+special"
                value={form.password}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="new-password"
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="new-password"
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
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
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
