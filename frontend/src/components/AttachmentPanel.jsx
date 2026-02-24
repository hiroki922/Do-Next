import { useRef, useState } from 'react'
import { uploadAttachment, deleteAttachment, getAttachmentUrl } from '../api'
import { getToken } from '../auth'

export default function AttachmentPanel({ todoId, attachmentsCount, onCountChange }) {
  const [attachments, setAttachments] = useState(null) // null = not loaded yet
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  async function handleExpand() {
    if (!expanded && attachments === null) {
      // 添付ファイル一覧を取得（Todo detail から取得済みのリストがないので簡易実装）
      setAttachments([])
    }
    setExpanded(!expanded)
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const att = await uploadAttachment(todoId, file)
      setAttachments(prev => [...(prev || []), att])
      onCountChange((attachmentsCount || 0) + 1)
    } catch (err) {
      setError(err.message)
    }
    fileRef.current.value = ''
  }

  async function handleDelete(id) {
    try {
      await deleteAttachment(todoId, id)
      setAttachments(prev => prev.filter(a => a.id !== id))
      onCountChange(Math.max(0, (attachmentsCount || 0) - 1))
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDownload(att) {
    const token = getToken()
    const url = getAttachmentUrl(todoId, att.id)
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', att.filename)
    // Bearerトークンが必要なためfetchで取得してBlobURLを生成
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob)
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  return (
    <div className="attachment-panel">
      <button className="attachment-toggle" onClick={handleExpand}>
        📎 {attachmentsCount > 0 ? attachmentsCount : ''} 添付
      </button>
      {expanded && (
        <div className="attachment-body">
          {error && <p className="error small">{error}</p>}
          {(attachments || []).map(att => (
            <div key={att.id} className="attachment-item">
              <span className="att-name" onClick={() => handleDownload(att)}>{att.filename}</span>
              <span className="att-size">{(att.size / 1024).toFixed(1)}KB</span>
              <button onClick={() => handleDelete(att.id)}>×</button>
            </div>
          ))}
          <label className="att-upload-btn">
            ファイルを追加
            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleUpload} />
          </label>
        </div>
      )}
    </div>
  )
}
