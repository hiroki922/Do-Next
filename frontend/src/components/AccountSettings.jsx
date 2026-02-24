import { useState } from 'react'
import { changePassword } from '../api'

export default function AccountSettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    if (newPassword !== confirm) {
      setError('新しいパスワードが一致しません')
      return
    }
    try {
      await changePassword(currentPassword, newPassword)
      setMessage('パスワードを変更しました')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="settings-page">
      <h2>アカウント設定</h2>
      <div className="settings-section">
        <h3>パスワード変更</h3>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="form">
          <input
            type="password"
            placeholder="現在のパスワード"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="新しいパスワード"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="新しいパスワード（確認）"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
          <button type="submit">変更する</button>
        </form>
      </div>
    </div>
  )
}
