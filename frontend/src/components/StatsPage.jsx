import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'
import { fetchStats } from '../api'

const PRIORITY_LABEL = { low: '低', medium: '中', high: '高' }
const PRIORITY_COLOR = { low: '#86efac', medium: '#fde68a', high: '#fca5a5' }
const PIE_COLORS = ['#3b82f6', '#e5e7eb']

export default function StatsPage({ lists, currentListId }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [listId, setListId] = useState(currentListId || '')

  useEffect(() => {
    load()
  }, [listId])

  async function load() {
    try {
      const data = await fetchStats(listId || null)
      setStats(data)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!stats) return <p className="loading">読み込み中...</p>

  const pieData = [
    { name: '完了', value: stats.completed },
    { name: '未完了', value: stats.total - stats.completed },
  ]

  const priorityData = Object.entries(stats.by_priority).map(([k, v]) => ({
    name: PRIORITY_LABEL[k] || k,
    件数: v,
    fill: PRIORITY_COLOR[k] || '#94a3b8',
  }))

  const tagData = Object.entries(stats.by_tag).map(([k, v]) => ({ name: k, 件数: v }))

  const weeklyData = stats.weekly_completed.map(w => ({
    date: w.date.slice(5),
    完了数: w.count,
  }))

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h2>統計</h2>
        <select value={listId} onChange={e => setListId(e.target.value)}>
          <option value="">全リスト</option>
          {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="stats-summary">
        <div className="stat-card">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-label">合計</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.completed}</span>
          <span className="stat-label">完了</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.completion_rate}%</span>
          <span className="stat-label">完了率</span>
        </div>
      </div>

      <div className="stats-charts">
        <div className="chart-box">
          <h3>完了率</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>優先度別</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="件数">
                {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {tagData.length > 0 && (
          <div className="chart-box">
            <h3>タグ別</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tagData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="件数" fill="#818cf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="chart-box">
          <h3>週間完了数（過去7日）</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="完了数" stroke="#3b82f6" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
