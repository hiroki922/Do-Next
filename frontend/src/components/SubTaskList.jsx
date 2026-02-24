import { useState } from 'react'
import { createSubTask, updateSubTask, deleteSubTask } from '../api'

export default function SubTaskList({ todoId, subTasks, onChange }) {
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const sub = await createSubTask(todoId, newTitle.trim())
      onChange([...subTasks, sub])
      setNewTitle('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggle(sub) {
    try {
      const updated = await updateSubTask(todoId, sub.id, { completed: !sub.completed })
      onChange(subTasks.map(s => s.id === sub.id ? updated : s))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSubTask(todoId, id)
      onChange(subTasks.filter(s => s.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="subtask-list">
      {error && <p className="error small">{error}</p>}
      {subTasks.map(sub => (
        <div key={sub.id} className={`subtask-item ${sub.completed ? 'completed' : ''}`}>
          <input
            type="checkbox"
            checked={sub.completed}
            onChange={() => handleToggle(sub)}
          />
          <span className="subtask-title">{sub.title}</span>
          <button className="subtask-delete" onClick={() => handleDelete(sub.id)}>×</button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="subtask-form">
        <input
          type="text"
          placeholder="サブタスクを追加..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
    </div>
  )
}
