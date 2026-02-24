import { useState, useEffect } from 'react'
import { fetchComments, createComment, deleteComment, fetchActivity } from '../api'

const ACTION_LABEL = {
  created: '作成',
  updated: '更新',
  completed: '完了',
  archived: 'アーカイブ',
  unarchived: 'アーカイブ解除',
  commented: 'コメント',
}

export default function CommentPanel({ todoId, onClose }) {
  const [tab, setTab] = useState('comments')
  const [comments, setComments] = useState([])
  const [activity, setActivity] = useState([])
  const [newContent, setNewContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadComments()
    loadActivity()
  }, [todoId])

  async function loadComments() {
    try {
      const data = await fetchComments(todoId)
      setComments(data)
    } catch {}
  }

  async function loadActivity() {
    try {
      const data = await fetchActivity(todoId)
      setActivity(data)
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!newContent.trim()) return
    setLoading(true)
    try {
      const c = await createComment(todoId, newContent.trim())
      setComments(prev => [...prev, c])
      setNewContent('')
    } catch {}
    setLoading(false)
  }

  async function handleDelete(commentId) {
    try {
      await deleteComment(todoId, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {}
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <div className="comment-tabs">
          <button className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>
            コメント {comments.length > 0 && <span className="badge">{comments.length}</span>}
          </button>
          <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>履歴</button>
        </div>
        <button className="comment-close" onClick={onClose}>×</button>
      </div>

      {tab === 'comments' && (
        <div className="comment-body">
          <div className="comment-list">
            {comments.length === 0 && <p className="comment-empty">コメントはありません</p>}
            {comments.map(c => (
              <div key={c.id} className="comment-item">
                <div className="comment-meta">
                  <span className="comment-author">{c.user_email}</span>
                  <span className="comment-date">{formatDate(c.created_at)}</span>
                  <button className="comment-delete" onClick={() => handleDelete(c.id)}>×</button>
                </div>
                <p className="comment-content">{c.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="comment-form">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="コメントを追加..."
              rows={2}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !newContent.trim()}>追加</button>
          </form>
        </div>
      )}

      {tab === 'activity' && (
        <div className="comment-body">
          <div className="activity-list">
            {activity.length === 0 && <p className="comment-empty">履歴はありません</p>}
            {activity.map(log => (
              <div key={log.id} className="activity-item">
                <span className={`activity-action action-${log.action}`}>{ACTION_LABEL[log.action] || log.action}</span>
                <span className="activity-user">{log.user_email}</span>
                {log.detail && <span className="activity-detail">{log.detail}</span>}
                <span className="activity-date">{formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
