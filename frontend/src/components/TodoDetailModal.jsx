const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' }
const RECURRENCE_LABEL = { none: 'なし', daily: '毎日', weekly: '毎週', monthly: '毎月' }

export default function TodoDetailModal({ todo, onClose }) {
  if (!todo) return null

  const completedSubs = (todo.sub_tasks || []).filter(s => s.completed).length
  const totalSubs = (todo.sub_tasks || []).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <span className={`priority-badge priority-${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</span>
          {todo.completed && <span className="modal-badge completed-badge">完了</span>}
          {todo.archived && <span className="modal-badge archived-badge">アーカイブ</span>}
        </div>

        <h2 className="modal-title">{todo.title}</h2>

        {todo.description && (
          <p className="modal-desc">{todo.description}</p>
        )}

        {todo.notes && (
          <div className="modal-notes">{todo.notes}</div>
        )}

        <div className="modal-meta">
          {todo.due_date && (
            <div className="modal-meta-row">
              <span className="modal-meta-label">期限</span>
              <span>{todo.due_date}{todo.due_time ? ` ${todo.due_time}` : ''}</span>
            </div>
          )}
          {todo.recurrence !== 'none' && (
            <div className="modal-meta-row">
              <span className="modal-meta-label">繰り返し</span>
              <span>{RECURRENCE_LABEL[todo.recurrence]}</span>
            </div>
          )}
          {todo.assignee_email && (
            <div className="modal-meta-row">
              <span className="modal-meta-label">担当者</span>
              <span>{todo.assignee_email}</span>
            </div>
          )}
          {totalSubs > 0 && (
            <div className="modal-meta-row">
              <span className="modal-meta-label">サブタスク</span>
              <span>{completedSubs}/{totalSubs} 完了</span>
            </div>
          )}
        </div>

        {todo.tags && todo.tags.length > 0 && (
          <div className="modal-tags">
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
        )}
      </div>
    </div>
  )
}
