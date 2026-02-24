import { useState } from 'react'
import { updateTodo, duplicateTodo } from '../api'
import SubTaskList from './SubTaskList'
import AttachmentPanel from './AttachmentPanel'
import CommentPanel from './CommentPanel'

const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' }
const PRIORITY_OPTIONS = ['low', 'medium', 'high']
const RECURRENCE_LABEL = { none: 'なし', daily: '毎日', weekly: '毎週', monthly: '毎月' }
const STATUS_LABEL = { todo: '未着手', in_progress: '進行中', done: '完了' }
const STATUS_OPTIONS = ['todo', 'in_progress', 'done']

function getDueSeverity(todo) {
  if (!todo.due_date || todo.completed) return null
  const now = new Date()
  const dueStr = todo.due_time ? `${todo.due_date}T${todo.due_time}` : `${todo.due_date}T23:59:59`
  const due = new Date(dueStr)
  const diffMs = due - now
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffMs < 0) return 'overdue'
  if (diffDays <= 3) return 'soon'
  return null
}

export default function TodoItem({ todo, tags, listMembers, onUpdate, onDelete, onDuplicate, selected, onSelect, dragHandleProps }) {
  const [editing, setEditing] = useState(false)
  const [showSubs, setShowSubs] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [subTasks, setSubTasks] = useState(todo.sub_tasks || [])
  const [attachmentsCount, setAttachmentsCount] = useState(todo.attachments_count || 0)

  // Edit form state
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDesc, setEditDesc] = useState(todo.description || '')
  const [editNotes, setEditNotes] = useState(todo.notes || '')
  const [editPriority, setEditPriority] = useState(todo.priority)
  const [editDue, setEditDue] = useState(todo.due_date || '')
  const [editDueTime, setEditDueTime] = useState(todo.due_time || '')
  const [editRecurrence, setEditRecurrence] = useState(todo.recurrence)
  const [editTagIds, setEditTagIds] = useState(todo.tags.map(t => t.id))
  const [editAssigneeId, setEditAssigneeId] = useState(todo.assignee_id || '')
  const [editStatus, setEditStatus] = useState(todo.status || 'todo')

  const dueSeverity = getDueSeverity(todo)

  async function handleToggle() {
    const updated = await updateTodo(todo.id, { completed: !todo.completed })
    onUpdate(updated)
  }

  async function handleSave() {
    const updated = await updateTodo(todo.id, {
      title: editTitle,
      description: editDesc || null,
      notes: editNotes || null,
      priority: editPriority,
      due_date: editDue || null,
      due_time: editDueTime || null,
      recurrence: editRecurrence,
      status: editStatus,
      tag_ids: editTagIds,
      assignee_id: editAssigneeId ? parseInt(editAssigneeId) : null,
    })
    onUpdate(updated)
    setEditing(false)
  }

  async function handleArchive() {
    const updated = await updateTodo(todo.id, { archived: !todo.archived })
    onUpdate(updated)
  }

  async function handleDuplicate() {
    const newTodo = await duplicateTodo(todo.id)
    if (onDuplicate) onDuplicate(newTodo)
  }

  function toggleEditTag(id) {
    setEditTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const itemClass = [
    'todo-item',
    todo.completed ? 'completed' : '',
    todo.archived ? 'archived' : '',
    dueSeverity === 'overdue' ? 'overdue' : '',
    dueSeverity === 'soon' ? 'due-soon' : '',
  ].filter(Boolean).join(' ')

  return (
    <li className={itemClass} {...(dragHandleProps || {})}>
      <input
        type="checkbox"
        className="bulk-checkbox"
        checked={selected}
        onChange={e => onSelect(todo.id, e.target.checked)}
        onClick={e => e.stopPropagation()}
      />

      {editing ? (
        <div className="todo-edit-form">
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="タイトル" />
          <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="説明" />
          <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="メモ" rows={3} />
          <div className="form-row">
            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>状態: {STATUS_LABEL[s]}</option>)}
            </select>
            <select value={editPriority} onChange={e => setEditPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>優先度: {PRIORITY_LABEL[p]}</option>)}
            </select>
            <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} />
            {editDue && (
              <input type="time" value={editDueTime} onChange={e => setEditDueTime(e.target.value)} title="期限時刻（任意）" />
            )}
            <select value={editRecurrence} onChange={e => setEditRecurrence(e.target.value)}>
              {Object.entries(RECURRENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {listMembers && listMembers.length > 0 && (
            <select value={editAssigneeId} onChange={e => setEditAssigneeId(e.target.value)}>
              <option value="">担当者なし</option>
              {listMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
            </select>
          )}
          {tags.length > 0 && (
            <div className="tag-select">
              {tags.map(tag => (
                <label
                  key={tag.id}
                  className={`tag-option ${editTagIds.includes(tag.id) ? 'selected' : ''}`}
                  style={tag.color ? { borderColor: editTagIds.includes(tag.id) ? tag.color : undefined, color: editTagIds.includes(tag.id) ? tag.color : undefined } : {}}
                >
                  <input type="checkbox" checked={editTagIds.includes(tag.id)} onChange={() => toggleEditTag(tag.id)} />
                  {tag.name}
                </label>
              ))}
            </div>
          )}
          <div className="edit-actions">
            <button className="btn-save" onClick={handleSave}>保存</button>
            <button className="btn-cancel" onClick={() => setEditing(false)}>キャンセル</button>
          </div>
        </div>
      ) : (
        <div className="todo-body">
          <div className="todo-top">
            <span className="todo-title">{todo.title}</span>
            <span className={`status-badge status-${todo.status || 'todo'}`}>{STATUS_LABEL[todo.status || 'todo']}</span>
            <span className={`priority-badge priority-${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</span>
            {todo.recurrence !== 'none' && (
              <span className="recurrence-badge">🔁 {RECURRENCE_LABEL[todo.recurrence]}</span>
            )}
            {todo.archived && <span className="archived-badge">アーカイブ</span>}
          </div>
          {todo.description && <span className="todo-desc">{todo.description}</span>}
          {todo.notes && <div className="todo-notes">{todo.notes}</div>}
          <div className="todo-meta">
            {todo.due_date && (
              <span className={`due-date ${dueSeverity === 'overdue' ? 'overdue-text' : dueSeverity === 'soon' ? 'soon-text' : ''}`}>
                期限: {todo.due_date}{todo.due_time ? ` ${todo.due_time}` : ''}{dueSeverity === 'soon' ? ' ⚠' : dueSeverity === 'overdue' ? ' !' : ''}
              </span>
            )}
            {todo.tags.map(tag => (
              <span
                key={tag.id}
                className="tag-chip small"
                style={tag.color ? { background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` } : {}}
              >
                {tag.name}
              </span>
            ))}
            {todo.assignee_email && (
              <span className="assignee-badge">👤 {todo.assignee_email}</span>
            )}
            {subTasks.length > 0 && (
              <span className="subtask-count">
                ✓ {subTasks.filter(s => s.completed).length}/{subTasks.length}
              </span>
            )}
          </div>

          <div className="todo-actions-row">
            <button className="btn-icon" onClick={() => setEditing(true)}>編集</button>
            <button className="btn-icon" onClick={() => setShowSubs(!showSubs)}>
              サブタスク {showSubs ? '▲' : '▼'}
            </button>
            <button
              className={`btn-icon ${showComments ? 'btn-icon-active' : ''}`}
              onClick={() => setShowComments(!showComments)}
            >
              💬 {todo.comments_count > 0 ? todo.comments_count : ''}
            </button>
            <AttachmentPanel
              todoId={todo.id}
              attachmentsCount={attachmentsCount}
              onCountChange={setAttachmentsCount}
            />
            <button className="btn-icon" onClick={handleDuplicate} title="複製">複製</button>
          </div>
        </div>
      )}

      {!editing && showSubs && (
        <div className="subtask-wrapper">
          <SubTaskList todoId={todo.id} subTasks={subTasks} onChange={setSubTasks} />
        </div>
      )}

      {!editing && showComments && (
        <div className="comment-wrapper">
          <CommentPanel todoId={todo.id} onClose={() => setShowComments(false)} />
        </div>
      )}

      <div className="item-right">
        <button className={`btn-complete ${todo.completed ? 'btn-complete-done' : ''}`} onClick={handleToggle}>
          {todo.completed ? '未完了' : '完了'}
        </button>
        <button className="btn-archive" onClick={handleArchive}>
          {todo.archived ? '復元' : 'アーカイブ'}
        </button>
        <button className="delete-btn" onClick={() => onDelete(todo.id)}>削除</button>
      </div>
    </li>
  )
}
