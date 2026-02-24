import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchTodos, createTodo, deleteTodo, bulkAction, updateTodoPosition,
  fetchTags, createTag, updateTag, deleteTag,
  fetchLists,
  login, register, logout,
} from './api'
import { getRefreshToken, setTokens, removeToken, isAuthenticated } from './auth'
import TodoItem from './components/TodoItem'
import BulkActions from './components/BulkActions'
import Pagination from './components/Pagination'
import StatsPage from './components/StatsPage'
import ListSidebar from './components/ListSidebar'
import AccountSettings from './components/AccountSettings'
import CalendarView from './components/CalendarView'
import KanbanView from './components/KanbanView'
import TodoDetailModal from './components/TodoDetailModal'

const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' }
const PRIORITY_OPTIONS = ['low', 'medium', 'high']
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'なし' },
  { value: 'daily', label: '毎日' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
]

const TAG_COLORS = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316']

// ---- Auth Screen ----
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'register') await register(email, password)
      const data = await login(email, password)
      setTokens(data.access_token, data.refresh_token)
      onLogin()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-container">
      <h1>Do-Next</h1>
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null) }}>ログイン</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null) }}>新規登録</button>
      </div>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit} className="form">
        <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">{mode === 'login' ? 'ログイン' : '登録'}</button>
      </form>
    </div>
  )
}

// ---- Tag Manager ----
function TagManager({ tags, onTagsChange }) {
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newTagName.trim()) return
    const tag = await createTag(newTagName.trim(), newTagColor)
    onTagsChange([...tags, tag])
    setNewTagName('')
  }

  async function handleColorChange(tag, color) {
    const updated = await updateTag(tag.id, { color })
    onTagsChange(tags.map(t => t.id === updated.id ? updated : t))
  }

  async function handleDelete(id) {
    await deleteTag(id)
    onTagsChange(tags.filter(t => t.id !== id))
  }

  return (
    <div className="tag-manager">
      <h3>タグ管理</h3>
      <form onSubmit={handleCreate} className="tag-form">
        <input type="text" placeholder="新しいタグ名" value={newTagName} onChange={e => setNewTagName(e.target.value)} />
        <div className="color-picker">
          {TAG_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`color-dot ${newTagColor === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setNewTagColor(c)}
            />
          ))}
        </div>
        <button type="submit">追加</button>
      </form>
      <div className="tag-list">
        {tags.map(tag => (
          <span
            key={tag.id}
            className="tag-chip tag-chip-manage"
            style={tag.color ? { background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` } : {}}
          >
            <span className="tag-color-indicator" style={{ background: tag.color || '#e5e7eb' }} />
            {tag.name}
            <div className="tag-color-row">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot mini ${tag.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => handleColorChange(tag, c)}
                />
              ))}
            </div>
            <button className="tag-delete" onClick={() => handleDelete(tag.id)}>×</button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ---- Main App ----
export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [page, setPage] = useState('todos') // 'todos' | 'kanban' | 'calendar' | 'stats' | 'settings'
  const [todos, setTodos] = useState([])
  const [calendarTodos, setCalendarTodos] = useState([])
  const [kanbanTodos, setKanbanTodos] = useState([])
  const [selectedCalTodo, setSelectedCalTodo] = useState(null)
  const [pagination, setPagination] = useState({ total: 0, page: 1, per_page: 20, pages: 1 })
  const [tags, setTags] = useState([])
  const [lists, setLists] = useState([])
  const [currentListId, setCurrentListId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [showTagManager, setShowTagManager] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [notifGranted, setNotifGranted] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  const [selectedTagIds, setSelectedTagIds] = useState([])

  // Filter state
  const [filterQ, setFilterQ] = useState('')
  const [filterCompleted, setFilterCompleted] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterTagId, setFilterTagId] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)


  // D&D
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  const currentList = lists.find(l => l.id === currentListId)
  const listMembers = currentList?.members || []

  const load = useCallback(async (pg = currentPage) => {
    if (!authed) return
    try {
      const params = { page: pg, per_page: 20, sort_by: sortBy, sort_order: sortOrder, archived: showArchived }
      if (currentListId) params.list_id = currentListId
      if (filterQ) params.q = filterQ
      if (filterCompleted !== '') params.completed = filterCompleted
      if (filterPriority) params.priority = filterPriority
      if (filterTagId) params.tag_id = filterTagId
      if (filterOverdue) params.overdue = true
      const data = await fetchTodos(params)
      setTodos(data.items)
      setPagination({ total: data.total, page: data.page, per_page: data.per_page, pages: data.pages })
      setSelectedIds(new Set())
    } catch (e) {
      setError(e.message)
    }
  }, [authed, currentPage, sortBy, sortOrder, currentListId, filterQ, filterCompleted, filterPriority, filterTagId, filterOverdue, showArchived])

  const loadCalendar = useCallback(async () => {
    if (!authed) return
    try {
      const params = { per_page: 200, page: 1, sort_by: 'due_date', sort_order: 'asc', archived: false }
      if (currentListId) params.list_id = currentListId
      const data = await fetchTodos(params)
      setCalendarTodos(data.items)
    } catch {}
  }, [authed, currentListId])

  const loadKanban = useCallback(async () => {
    if (!authed) return
    try {
      const params = { per_page: 500, page: 1, sort_by: 'created_at', sort_order: 'asc', archived: false }
      if (currentListId) params.list_id = currentListId
      const data = await fetchTodos(params)
      setKanbanTodos(data.items)
    } catch {}
  }, [authed, currentListId])

  useEffect(() => {
    if (authed) {
      load()
      fetchTags().then(setTags).catch(() => {})
      fetchLists().then(setLists).catch(() => {})
      loadCalendar()
      loadKanban()
    }
  }, [authed, load, loadCalendar, loadKanban])

  useEffect(() => {
    if (!authed || !('Notification' in window)) return
    if (Notification.permission === 'granted') setNotifGranted(true)
  }, [authed])

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotifGranted(true)
      const today = new Date().toISOString().slice(0, 10)
      const overdueTodos = todos.filter(t => !t.completed && !t.archived && t.due_date && t.due_date < today)
      if (overdueTodos.length > 0) {
        new Notification('Do-Next: 期限切れのタスクがあります', {
          body: `${overdueTodos.length}件のタスクが期限を過ぎています`,
          icon: '/vite.svg',
        })
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await createTodo({
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        priority,
        due_date: dueDate || null,
        due_time: dueTime || null,
        recurrence,
        tag_ids: selectedTagIds,
        list_id: currentListId,
      })
      setTitle(''); setDescription(''); setNotes('')
      setPriority('medium'); setDueDate(''); setDueTime(''); setRecurrence('none'); setSelectedTagIds([])
      setShowCreateModal(false)
      load(1); setCurrentPage(1)
    } catch (e) { setError(e.message) }
  }

  async function handleBulkComplete() {
    try { await bulkAction([...selectedIds], 'complete'); load() } catch (e) { setError(e.message) }
  }

  async function handleBulkDelete() {
    if (!confirm(`${selectedIds.size}件削除しますか？`)) return
    try { await bulkAction([...selectedIds], 'delete'); load() } catch (e) { setError(e.message) }
  }

  async function handleBulkArchive() {
    try { await bulkAction([...selectedIds], showArchived ? 'unarchive' : 'archive'); load() } catch (e) { setError(e.message) }
  }

  function handleSelectAll(checked) {
    setSelectedIds(checked ? new Set(todos.map(t => t.id)) : new Set())
  }

  function handleSelect(id, checked) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  async function handleLogout() {
    try { await logout(getRefreshToken()) } catch {}
    removeToken()
    setAuthed(false)
  }

  function handlePageChange(pg) {
    setCurrentPage(pg)
    load(pg)
  }

  function handleListSelect(id) {
    setCurrentListId(id)
    setCurrentPage(1)
  }

  function toggleTagSelect(id) {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }


  // D&D handlers
  function handleDragStart(idx) { dragItem.current = idx }
  function handleDragEnter(idx) { dragOverItem.current = idx }

  async function handleDrop() {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return
    const reordered = [...todos]
    const dragged = reordered.splice(dragItem.current, 1)[0]
    reordered.splice(dragOverItem.current, 0, dragged)
    setTodos(reordered)
    try { await Promise.all(reordered.map((todo, idx) => updateTodoPosition(todo.id, idx))) } catch {}
    dragItem.current = null; dragOverItem.current = null
  }

  if (!authed) return <AuthScreen onLogin={() => setAuthed(true)} />

  return (
    <div className="app-layout">
      <ListSidebar
        lists={lists}
        currentListId={currentListId}
        onSelect={handleListSelect}
        onListsChange={setLists}
      />

      <div className="main-content">
        <header className="app-header">
          <div className="nav-tabs">
            <button className={page === 'todos' ? 'nav-active' : ''} onClick={() => setPage('todos')}>Todo</button>
            <button className={page === 'kanban' ? 'nav-active' : ''} onClick={() => { setPage('kanban'); loadKanban() }}>ボード</button>
            <button className={page === 'calendar' ? 'nav-active' : ''} onClick={() => setPage('calendar')}>カレンダー</button>
            <button className={page === 'stats' ? 'nav-active' : ''} onClick={() => setPage('stats')}>統計</button>
            <button className={page === 'settings' ? 'nav-active' : ''} onClick={() => setPage('settings')}>設定</button>
          </div>
          <div className="header-actions">
            {!notifGranted && 'Notification' in window && (
              <button className="btn-secondary" onClick={requestNotificationPermission} title="期限通知を有効にする">🔔</button>
            )}
            <button className="btn-secondary" onClick={() => setShowTagManager(!showTagManager)}>タグ管理</button>
            <button className="btn-secondary" onClick={handleLogout}>ログアウト</button>
          </div>
        </header>

        {error && <p className="error" onClick={() => setError(null)}>{error}（クリックで閉じる）</p>}

        {page === 'stats' && <StatsPage lists={lists} currentListId={currentListId} />}
        {page === 'settings' && <AccountSettings />}
        {page === 'calendar' && <CalendarView todos={calendarTodos} onTodoClick={setSelectedCalTodo} />}
        {page === 'kanban' && (
          <KanbanView
            todos={kanbanTodos}
            onTodosChange={setKanbanTodos}
            onStatusChange={(id, updated) => {
              setTodos(prev => prev.map(t => t.id === id ? { ...t, status: updated.status } : t))
            }}
            onTodoClick={setSelectedCalTodo}
          />
        )}
        <TodoDetailModal todo={selectedCalTodo} onClose={() => setSelectedCalTodo(null)} />

        {page === 'todos' && (
          <div>
            {showTagManager && <TagManager tags={tags} onTagsChange={setTags} />}
            <div className="filters">
              <input type="text" placeholder="検索..." value={filterQ} onChange={e => setFilterQ(e.target.value)} className="filter-search" />
              <select value={filterCompleted} onChange={e => setFilterCompleted(e.target.value)}>
                <option value="">全て</option>
                <option value="false">未完了</option>
                <option value="true">完了</option>
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">全優先度</option>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
              {tags.length > 0 && (
                <select value={filterTagId} onChange={e => setFilterTagId(e.target.value)}>
                  <option value="">全タグ</option>
                  {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                </select>
              )}
              <select value={`${sortBy}|${sortOrder}`} onChange={e => {
                const [sb, so] = e.target.value.split('|')
                setSortBy(sb); setSortOrder(so)
              }}>
                <option value="created_at|desc">作成日↓</option>
                <option value="created_at|asc">作成日↑</option>
                <option value="due_date|asc">期限↑</option>
                <option value="due_date|desc">期限↓</option>
                <option value="priority|desc">優先度↓</option>
                <option value="priority|asc">優先度↑</option>
                <option value="position|asc">手動順</option>
              </select>
              <button
                className={`btn-secondary${filterOverdue ? ' filter-active' : ''}`}
                onClick={() => { setFilterOverdue(!filterOverdue); setCurrentPage(1) }}
              >
                期限切れ
              </button>
              <button
                className={`btn-secondary${showArchived ? ' filter-active' : ''}`}
                onClick={() => { setShowArchived(!showArchived); setCurrentPage(1) }}
              >
                {showArchived ? 'アーカイブ中' : 'アーカイブ'}
              </button>
              <button className="btn-secondary" onClick={() => load()}>再読込</button>
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>＋ 新規タスク</button>
            </div>

            <BulkActions
              todos={todos}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onBulkComplete={handleBulkComplete}
              onBulkDelete={handleBulkDelete}
              onBulkArchive={handleBulkArchive}
              showArchived={showArchived}
            />

            <ul className="todo-list">
              {todos.map((todo, idx) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  tags={tags}
                  listMembers={listMembers}
                  selected={selectedIds.has(todo.id)}
                  onSelect={handleSelect}
                  onUpdate={updated => setTodos(todos.map(t => t.id === updated.id ? updated : t))}
                  onDelete={id => { deleteTodo(id); setTodos(todos.filter(t => t.id !== id)) }}
                  onDuplicate={() => load()}
                  dragHandleProps={{
                    draggable: true,
                    onDragStart: () => handleDragStart(idx),
                    onDragEnter: () => handleDragEnter(idx),
                    onDragEnd: handleDrop,
                    onDragOver: e => e.preventDefault(),
                  }}
                />
              ))}
            </ul>

            {todos.length === 0 && <p className="empty">Todoがありません</p>}

            <Pagination
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
              perPage={pagination.per_page}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {showCreateModal && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false) }}>
            <div className="modal-panel">
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 14, color: '#111827' }}>新規タスク作成</h3>
              <form onSubmit={handleSubmit} className="form" style={{ boxShadow: 'none', background: 'transparent', padding: 0, marginBottom: 0 }}>
                <input type="text" placeholder="タイトル" value={title} onChange={e => setTitle(e.target.value)} required />
                <input type="text" placeholder="説明（任意）" value={description} onChange={e => setDescription(e.target.value)} />
                <textarea placeholder="メモ（任意）" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                <div className="form-row">
                  <select value={priority} onChange={e => setPriority(e.target.value)}>
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>優先度: {PRIORITY_LABEL[p]}</option>)}
                  </select>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} title="期限日" />
                  {dueDate && (
                    <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} title="期限時刻（任意）" />
                  )}
                  <select value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                    {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>繰り返し: {r.label}</option>)}
                  </select>
                </div>
                {tags.length > 0 && (
                  <div className="tag-select">
                    {tags.map(tag => (
                      <label
                        key={tag.id}
                        className={`tag-option ${selectedTagIds.includes(tag.id) ? 'selected' : ''}`}
                        style={tag.color && selectedTagIds.includes(tag.id) ? { borderColor: tag.color, color: tag.color } : {}}
                      >
                        <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => toggleTagSelect(tag.id)} />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                )}
                <button type="submit">追加</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
