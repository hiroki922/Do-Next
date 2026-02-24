import { useState } from 'react'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

function getNthMonday(year, month0, n) {
  // Returns the day-of-month of the n-th Monday in the given month (month0 = 0-indexed)
  const d = new Date(year, month0, 1)
  const first = (1 - d.getDay() + 7) % 7 // days until first Monday
  return first + 1 + (n - 1) * 7
}

function getJapaneseHolidays(year) {
  const holidays = {}

  function add(month, day, name) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    holidays[dateStr] = name
  }

  // Fixed-date holidays
  add(1,  1,  '元日')
  add(2,  11, '建国記念の日')
  add(2,  23, '天皇誕生日')
  add(4,  29, '昭和の日')
  add(5,  3,  '憲法記念日')
  add(5,  4,  'みどりの日')
  add(5,  5,  'こどもの日')
  add(8,  11, '山の日')
  add(11, 3,  '文化の日')
  add(11, 23, '勤労感謝の日')

  // Equinoxes (approximate formula, valid 1980–2099)
  const dy = year - 1980
  add(3, Math.floor(20.8431 + 0.242194 * dy - Math.floor(dy / 4)), '春分の日')
  add(9, Math.floor(23.2488 + 0.242194 * dy - Math.floor(dy / 4)), '秋分の日')

  // Happy Monday holidays
  add(1,  getNthMonday(year, 0, 2), '成人の日')     // 2nd Mon of Jan
  add(7,  getNthMonday(year, 6, 3), '海の日')        // 3rd Mon of Jul
  add(9,  getNthMonday(year, 8, 3), '敬老の日')      // 3rd Mon of Sep
  add(10, getNthMonday(year, 9, 2), 'スポーツの日')  // 2nd Mon of Oct

  // Substitute holidays (振替休日): holiday on Sunday → next non-holiday weekday
  for (const dateStr of Object.keys(holidays).sort()) {
    const d = new Date(dateStr + 'T00:00:00')
    if (d.getDay() === 0) {
      const next = new Date(dateStr + 'T00:00:00')
      next.setDate(next.getDate() + 1)
      while (true) {
        const s = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
        if (!holidays[s]) { holidays[s] = '振替休日'; break }
        next.setDate(next.getDate() + 1)
      }
    }
  }

  return holidays
}

export default function CalendarView({ todos, onTodoClick }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const holidays = getJapaneseHolidays(year)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0=Sun

  // Build todo map keyed by date string "YYYY-MM-DD"
  const todoMap = {}
  todos.forEach(todo => {
    if (todo.due_date && !todo.archived) {
      const key = todo.due_date
      if (!todoMap[key]) todoMap[key] = []
      todoMap[key].push(todo)
    }
  })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <span className="cal-title">{year}年 {month + 1}月</span>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map(w => (
          <div key={w} className={`cal-weekday ${w === '日' ? 'sun' : w === '土' ? 'sat' : ''}`}>{w}</div>
        ))}

        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="cal-cell empty" />

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === today.toISOString().slice(0, 10)
          const dayTodos = todoMap[dateStr] || []
          const dow = (startOffset + day - 1) % 7
          const holiday = holidays[dateStr]

          const cellClass = [
            'cal-cell',
            isToday ? 'today' : '',
            dow === 0 || holiday ? 'sun' : dow === 6 ? 'sat' : '',
          ].filter(Boolean).join(' ')

          return (
            <div key={dateStr} className={cellClass}>
              <span className="cal-day">{day}</span>
              {holiday && <div className="cal-holiday" title={holiday}>{holiday}</div>}
              <div className="cal-todos">
                {dayTodos.slice(0, 3).map(todo => (
                  <div
                    key={todo.id}
                    className={`cal-todo-chip ${todo.completed ? 'completed' : ''}`}
                    style={{ borderLeftColor: PRIORITY_COLOR[todo.priority] }}
                    onClick={() => onTodoClick && onTodoClick(todo)}
                    title={todo.title}
                  >
                    {todo.title}
                  </div>
                ))}
                {dayTodos.length > 3 && (
                  <div className="cal-more">+{dayTodos.length - 3}件</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
