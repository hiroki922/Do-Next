import { useState, useRef, useEffect, useCallback } from 'react'
import { createList, deleteList, addListMember, removeListMember, updateList } from '../api'

const MIN_WIDTH = 36
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 220
const COLLAPSED_WIDTH = 36

export default function ListSidebar({ lists, currentListId, onSelect, onListsChange }) {
  const [newListName, setNewListName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [managingListId, setManagingListId] = useState(null)
  const [error, setError] = useState(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onMouseDown = useCallback((e) => {
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return
      const next = startWidth.current + (e.clientX - startX.current)
      if (next <= MIN_WIDTH + 20) {
        setCollapsed(true)
        setWidth(COLLAPSED_WIDTH)
      } else {
        setCollapsed(false)
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH + 20, next)))
      }
    }
    function onMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function toggleCollapse() {
    if (collapsed) {
      setCollapsed(false)
      setWidth(DEFAULT_WIDTH)
    } else {
      setCollapsed(true)
      setWidth(COLLAPSED_WIDTH)
    }
  }

  async function handleCreateList(e) {
    e.preventDefault()
    if (!newListName.trim()) return
    try {
      const lst = await createList(newListName.trim())
      onListsChange([...lists, lst])
      setNewListName('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteList(id) {
    if (!confirm('リストを削除しますか？（Todoも全て削除されます）')) return
    try {
      await deleteList(id)
      onListsChange(lists.filter(l => l.id !== id))
      if (currentListId === id) onSelect(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!memberEmail.trim() || !managingListId) return
    try {
      const updated = await addListMember(managingListId, memberEmail.trim())
      onListsChange(lists.map(l => l.id === managingListId ? updated : l))
      setMemberEmail('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveMember(listId, userId) {
    try {
      await removeListMember(listId, userId)
      onListsChange(lists.map(l => {
        if (l.id !== listId) return l
        return { ...l, members: l.members.filter(m => m.id !== userId) }
      }))
    } catch (err) {
      setError(err.message)
    }
  }

  const managingList = lists.find(l => l.id === managingListId)

  return (
    <aside
      className={`list-sidebar${collapsed ? ' list-sidebar-collapsed' : ''}`}
      style={{ width: `${width}px` }}
    >
      <button className="sidebar-toggle" onClick={toggleCollapse} title={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}>
        {collapsed ? '▶' : '◀'}
      </button>

      {!collapsed && (
        <>
          <h3>リスト</h3>
          {error && <p className="error small" onClick={() => setError(null)}>{error}</p>}

          <ul className="list-items">
            <li
              className={`list-item ${!currentListId ? 'active' : ''}`}
              onClick={() => onSelect(null)}
            >
              全て
            </li>
            {lists.map(lst => (
              <li
                key={lst.id}
                className={`list-item ${currentListId === lst.id ? 'active' : ''}`}
              >
                <span onClick={() => onSelect(lst.id)}>{lst.name}</span>
                <div className="list-item-actions">
                  <button onClick={() => setManagingListId(managingListId === lst.id ? null : lst.id)}>
                    ⚙
                  </button>
                  <button className="list-delete" onClick={() => handleDeleteList(lst.id)}>×</button>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={handleCreateList} className="new-list-form">
            <input
              type="text"
              placeholder="新しいリスト..."
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
            />
            <button type="submit">+</button>
          </form>

          {managingList && (
            <div className="member-manager">
              <h4>{managingList.name} のメンバー</h4>
              {managingList.members.map(m => (
                <div key={m.id} className="member-row">
                  <span>{m.email}</span>
                  <span className="member-role">{m.role}</span>
                  {m.role !== 'owner' && (
                    <button onClick={() => handleRemoveMember(managingList.id, m.id)}>×</button>
                  )}
                </div>
              ))}
              <form onSubmit={handleAddMember} className="member-form">
                <input
                  type="email"
                  placeholder="メールアドレスで招待"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                />
                <button type="submit">招待</button>
              </form>
            </div>
          )}
        </>
      )}
      <div className="sidebar-resizer" onMouseDown={onMouseDown} />
    </aside>
  )
}
