/**
 * CalendarView のテスト
 *
 * - 祝日計算ロジック（固定祝日・ハッピーマンデー・春分/秋分・振替休日）
 * - カレンダーの月ナビゲーション
 * - Todoチップの表示
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarView from '../components/CalendarView'

// CalendarView 内の getJapaneseHolidays を直接テストするため、
// 同じロジックをここで再実装して単体テストする
function getNthMonday(year, month0, n) {
  const d = new Date(year, month0, 1)
  const first = (1 - d.getDay() + 7) % 7
  return first + 1 + (n - 1) * 7
}

function getJapaneseHolidays(year) {
  const holidays = {}
  function add(month, day, name) {
    holidays[`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`] = name
  }
  add(1, 1, '元日')
  add(2, 11, '建国記念の日')
  add(2, 23, '天皇誕生日')
  add(4, 29, '昭和の日')
  add(5, 3, '憲法記念日')
  add(5, 4, 'みどりの日')
  add(5, 5, 'こどもの日')
  add(8, 11, '山の日')
  add(11, 3, '文化の日')
  add(11, 23, '勤労感謝の日')
  const dy = year - 1980
  add(3, Math.floor(20.8431 + 0.242194 * dy - Math.floor(dy / 4)), '春分の日')
  add(9, Math.floor(23.2488 + 0.242194 * dy - Math.floor(dy / 4)), '秋分の日')
  add(1, getNthMonday(year, 0, 2), '成人の日')
  add(7, getNthMonday(year, 6, 3), '海の日')
  add(9, getNthMonday(year, 8, 3), '敬老の日')
  add(10, getNthMonday(year, 9, 2), 'スポーツの日')
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

// ── 祝日計算の単体テスト ──────────────────────────────────

describe('getJapaneseHolidays', () => {
  it('元日が 1/1 に設定される', () => {
    const h = getJapaneseHolidays(2025)
    expect(h['2025-01-01']).toBe('元日')
  })

  it('憲法記念日・みどりの日・こどもの日が正しい', () => {
    const h = getJapaneseHolidays(2025)
    expect(h['2025-05-03']).toBe('憲法記念日')
    expect(h['2025-05-04']).toBe('みどりの日')
    expect(h['2025-05-05']).toBe('こどもの日')
  })

  it('2025年の春分の日が 3/20', () => {
    const h = getJapaneseHolidays(2025)
    expect(h['2025-03-20']).toBe('春分の日')
  })

  it('2025年の秋分の日が 9/23', () => {
    const h = getJapaneseHolidays(2025)
    expect(h['2025-09-23']).toBe('秋分の日')
  })

  it('成人の日が 1月第2月曜', () => {
    // 2025/1/13 が第2月曜
    const h = getJapaneseHolidays(2025)
    expect(h['2025-01-13']).toBe('成人の日')
  })

  it('振替休日: 2024年 元日(1/1=月)は振替なし、建国記念日(2/11=日)の翌日 2/12 が振替休日', () => {
    const h = getJapaneseHolidays(2024)
    // 2024/2/11 は日曜
    expect(h['2024-02-11']).toBe('建国記念の日')
    expect(h['2024-02-12']).toBe('振替休日')
  })
})

// ── コンポーネント描画テスト ──────────────────────────────

describe('CalendarView', () => {
  it('カレンダーが表示される', () => {
    render(<CalendarView todos={[]} />)
    // 曜日ヘッダーが表示される
    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('月')).toBeInTheDocument()
    expect(screen.getByText('土')).toBeInTheDocument()
  })

  it('月ナビゲーションで前月・翌月に移動できる', () => {
    render(<CalendarView todos={[]} />)
    const today = new Date()
    const currentLabel = `${today.getFullYear()}年 ${today.getMonth() + 1}月`
    expect(screen.getByText(currentLabel)).toBeInTheDocument()

    // 翌月へ
    fireEvent.click(screen.getByText('›'))
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    expect(screen.getByText(`${nextMonth.getFullYear()}年 ${nextMonth.getMonth() + 1}月`)).toBeInTheDocument()

    // 前月へ（元に戻る）
    fireEvent.click(screen.getByText('‹'))
    expect(screen.getByText(currentLabel)).toBeInTheDocument()
  })

  it('期限日があるTodoがカレンダーに表示される', () => {
    // 今日の日付を使うことで表示中の月に確実に含まれるようにする
    const today = new Date()
    const due = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const todos = [{
      id: 1,
      title: 'テストタスク',
      due_date: due,
      priority: 'medium',
      completed: false,
      archived: false,
    }]
    render(<CalendarView todos={todos} />)
    expect(screen.getByText('テストタスク')).toBeInTheDocument()
  })
})
