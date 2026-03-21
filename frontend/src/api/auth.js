import api from './client'

/**
 * Register a new user account.
 * Returns the created user object.
 */
export const registerUser = (data) =>
  api.post('/auth/register/', data)

/**
 * Forgot password — validate email and trigger reset.
 * Returns { message: '...' }.
 */
export const forgotPassword = (email) =>
  api.post('/auth/forgot-password/', { email })

/**
 * Login with username and password.
 * Returns { access, refresh } tokens.
 */
export const loginUser = (credentials) =>
  api.post('/auth/login/', credentials)

/**
 * Get the currently authenticated user's profile.
 * Returns { id, username, email, role, first_name, last_name }.
 */
export const getMe = () =>
  api.get('/auth/me/')

/**
 * Refresh an expired access token.
 * Returns { access }.
 */
export const refreshToken = (refresh) =>
  api.post('/auth/token/refresh/', { refresh })

/**
 * Admin: list all users.
 */
export const getUsers = () =>
  api.get('/auth/users/')

/**
 * Admin: assign a role to a user.
 */
export const assignRole = (userId, role) =>
  api.patch(`/auth/users/${userId}/role/`, { role })

