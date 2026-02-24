const ACCESS_KEY = 'todo_access_token'
const REFRESH_KEY = 'todo_refresh_token'

export function getToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function setToken(token) {
  localStorage.setItem(ACCESS_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isAuthenticated() {
  return !!getToken()
}
