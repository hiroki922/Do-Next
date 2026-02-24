import { useState, useRef } from 'react'
import { updateTodo } from '../api'

const STATUS_COLUMNS = [
  { key: 'todo', label: '未着手' },
  { key: 'in_progress', label: '進行中' },
  { key: 'done', label: '完了' },
]

const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' }

export default function KanbanView({ todos, onTodosChange, onStatusChange, onTodoClick }) {
  const dragId = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  function handleDragStart(todo) {
    dragId.current = todo.id
  }

  function handleDragOver(e, colKey) {
    e.preventDefault()
    setDragOver(colKey)
  }

  function handleDragLeave(e) {
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null)
    }
  }

  function handleDragEnd() {
    dragId.current = null
    setDragOver(null)
  }

  async function handleDrop(e, colKey) {
    e.preventDefault()
    setDragOver(null)
    const id = dragId.current
    dragId.current = null
    if (!id) return
    const todo = todos.find(t => t.id === id)
    if (!todo || (todo.status || 'todo') === colKey) return

    const prevTodos = todos
    // 楽観的更新
    onTodosChange(todos.map(t => t.id === id ? { ...t, status: colKey } : t))
    try {
      const updated = await updateTodo(id, { status: colKey })
      // サーバーレスポンスで確定更新
      onTodosChange(todos.map(t => t.id === id ? updated : t))
      // メインのTodoリストにも反映
      if (onStatusChange) onStatusChange(id, updated)
    } catch {
      onTodosChange(prevTodos)
    }
  }

  return (
    <div className="kanban-board">
      {STATUS_COLUMNS.map(col => {
        const colTodos = todos.filter(t => !t.archived && (t.status || 'todo') === col.key)

        return (
          <div
            key={col.key}
            className={`kanban-col${dragOver === col.key ? ' kanban-col-over' : ''}`}
            onDragOver={e => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className="kanban-col-header">
              <span className={`status-badge status-${col.key}`}>{col.label}</span>
              <span className="kanban-count">{colTodos.length}</span>
            </div>

            <div className="kanban-cards">
              {colTodos.map(todo => (
                <div
                  key={todo.id}
                  className={`kanban-card${todo.completed ? ' kanban-card-done' : ''}`}
                  style={{ borderLeftColor: todo.priority === 'high' ? '#ef4444' : todo.priority === 'medium' ? '#f59e0b' : '#22c55e' }}
                  draggable
                  onDragStart={() => handleDragStart(todo)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onTodoClick && onTodoClick(todo)}
                >
                  <div className="kanban-card-title">{todo.title}</div>
                  {todo.description && (
                    <div className="kanban-card-desc">{todo.description}</div>
                  )}
                  <div className="kanban-card-meta">
                    <span className={`priority-badge priority-${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</span>
                    {todo.due_date && <span className="kanban-due">{todo.due_date}</span>}
                    {todo.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="tag-chip small"
                        style={tag.color ? { background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` } : {}}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {colTodos.length === 0 && (
                <div className="kanban-empty">タスクなし</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
