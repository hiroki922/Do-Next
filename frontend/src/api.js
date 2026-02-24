import { getToken, getRefreshToken, setTokens, removeToken } from './auth'

const BASE_URL = 'http://localhost:8000'

let isRefreshing = false
let refreshQueue = []

function processQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  refreshQueue = []
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('no refresh token')
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) {
    removeToken()
    window.location.reload()
    throw new Error('refresh failed')
  }
  const data = await res.json()
  setTokens(data.access_token, data.refresh_token)
  return data.access_token
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      }).then(newToken => {
        headers.Authorization = `Bearer ${newToken}`
        return fetch(`${BASE_URL}${path}`, { ...options, headers })
      })
    }
    isRefreshing = true
    try {
      const newToken = await refreshAccessToken()
      processQueue(null, newToken)
      headers.Authorization = `Bearer ${newToken}`
      return fetch(`${BASE_URL}${path}`, { ...options, headers })
    } catch (err) {
      processQueue(err)
      throw err
    } finally {
      isRefreshing = false
    }
  }

  return res
}

// ---- Auth ----

export async function register(email, password) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || '登録失敗')
  }
  return res.json()
}

export async function login(email, password) {
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'ログイン失敗')
  }
  return res.json()
}

export async function logout(refreshToken) {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

export async function changePassword(currentPassword, newPassword) {
  const res = await request('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'パスワード変更失敗')
  }
}

// ---- Tags ----

export async function fetchTags() {
  const res = await request('/tags/')
  if (!res.ok) throw new Error('タグ取得失敗')
  return res.json()
}

export async function createTag(name, color = null) {
  const res = await request('/tags/', { method: 'POST', body: JSON.stringify({ name, color }) })
  if (!res.ok) throw new Error('タグ作成失敗')
  return res.json()
}

export async function updateTag(id, data) {
  const res = await request(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  if (!res.ok) throw new Error('タグ更新失敗')
  return res.json()
}

export async function deleteTag(id) {
  const res = await request(`/tags/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('タグ削除失敗')
}

// ---- Lists ----

export async function fetchLists() {
  const res = await request('/lists/')
  if (!res.ok) throw new Error('リスト取得失敗')
  return res.json()
}

export async function createList(name) {
  const res = await request('/lists/', { method: 'POST', body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error('リスト作成失敗')
  return res.json()
}

export async function updateList(id, name) {
  const res = await request(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error('リスト更新失敗')
  return res.json()
}

export async function deleteList(id) {
  const res = await request(`/lists/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('リスト削除失敗')
}

export async function addListMember(listId, email) {
  const res = await request(`/lists/${listId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'メンバー追加失敗')
  }
  return res.json()
}

export async function removeListMember(listId, userId) {
  const res = await request(`/lists/${listId}/members/${userId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('メンバー削除失敗')
}

// ---- Todos ----

export async function fetchTodos(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') qs.append(k, v)
  })
  const res = await request(`/todos/?${qs.toString()}`)
  if (!res.ok) throw new Error('取得失敗')
  return res.json()
}

export async function createTodo(data) {
  const res = await request('/todos/', { method: 'POST', body: JSON.stringify(data) })
  if (!res.ok) throw new Error('作成失敗')
  return res.json()
}

export async function updateTodo(id, data) {
  const res = await request(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  if (!res.ok) throw new Error('更新失敗')
  return res.json()
}

export async function deleteTodo(id) {
  const res = await request(`/todos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('削除失敗')
}

export async function duplicateTodo(id) {
  const res = await request(`/todos/${id}/duplicate`, { method: 'POST' })
  if (!res.ok) throw new Error('複製失敗')
  return res.json()
}

export async function updateTodoPosition(id, position) {
  const res = await request(`/todos/${id}/position`, {
    method: 'PATCH',
    body: JSON.stringify({ position }),
  })
  if (!res.ok) throw new Error('位置更新失敗')
  return res.json()
}

export async function bulkAction(ids, action) {
  const res = await request('/todos/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action }),
  })
  if (!res.ok) throw new Error('一括操作失敗')
}

export function getExportUrl(params = {}) {
  const qs = new URLSearchParams()
  const token = getToken()
  if (token) qs.append('token', token)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') qs.append(k, v)
  })
  return `${BASE_URL}/todos/export?${qs.toString()}`
}

export async function exportTodosCSV(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') qs.append(k, v)
  })
  const res = await request(`/todos/export?${qs.toString()}`)
  if (!res.ok) throw new Error('エクスポート失敗')
  return res.blob()
}

// ---- SubTasks ----

export async function fetchSubTasks(todoId) {
  const res = await request(`/todos/${todoId}/subtasks`)
  if (!res.ok) throw new Error('サブタスク取得失敗')
  return res.json()
}

export async function createSubTask(todoId, title) {
  const res = await request(`/todos/${todoId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('サブタスク作成失敗')
  return res.json()
}

export async function updateSubTask(todoId, subId, data) {
  const res = await request(`/todos/${todoId}/subtasks/${subId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('サブタスク更新失敗')
  return res.json()
}

export async function deleteSubTask(todoId, subId) {
  const res = await request(`/todos/${todoId}/subtasks/${subId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('サブタスク削除失敗')
}

// ---- Attachments ----

export async function uploadAttachment(todoId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request(`/todos/${todoId}/attachments`, {
    method: 'POST',
    body: formData,
    headers: {},
  })
  if (!res.ok) throw new Error('アップロード失敗')
  return res.json()
}

export function getAttachmentUrl(todoId, attId) {
  return `${BASE_URL}/todos/${todoId}/attachments/${attId}`
}

export async function deleteAttachment(todoId, attId) {
  const res = await request(`/todos/${todoId}/attachments/${attId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('添付削除失敗')
}

// ---- Comments ----

export async function fetchComments(todoId) {
  const res = await request(`/todos/${todoId}/comments`)
  if (!res.ok) throw new Error('コメント取得失敗')
  return res.json()
}

export async function createComment(todoId, content) {
  const res = await request(`/todos/${todoId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('コメント追加失敗')
  return res.json()
}

export async function deleteComment(todoId, commentId) {
  const res = await request(`/todos/${todoId}/comments/${commentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('コメント削除失敗')
}

// ---- Activity ----

export async function fetchActivity(todoId) {
  const res = await request(`/todos/${todoId}/activity`)
  if (!res.ok) throw new Error('アクティビティ取得失敗')
  return res.json()
}

// ---- Stats ----

export async function fetchStats(listId) {
  const qs = listId ? `?list_id=${listId}` : ''
  const res = await request(`/stats/${qs}`)
  if (!res.ok) throw new Error('統計取得失敗')
  return res.json()
}
