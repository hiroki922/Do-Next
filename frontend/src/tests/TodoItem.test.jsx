/**
 * TodoItem コンポーネントのテスト
 *
 * - タイトル・説明・優先度バッジ・ステータスバッジの表示
 * - 完了チェックボックスの動作
 * - 編集モードへの切り替え
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TodoItem from '../components/TodoItem'

// API 呼び出しをモック（実際のHTTPリクエストを発生させない）
vi.mock('../api', () => ({
  updateTodo: vi.fn().mockResolvedValue({}),
  deleteTodo: vi.fn().mockResolvedValue({}),
  duplicateTodo: vi.fn().mockResolvedValue({}),
  getTodoComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn().mockResolvedValue({}),
  deleteComment: vi.fn().mockResolvedValue({}),
  getTodoActivities: vi.fn().mockResolvedValue([]),
  getSubTasks: vi.fn().mockResolvedValue([]),
  createSubTask: vi.fn().mockResolvedValue({}),
  updateSubTask: vi.fn().mockResolvedValue({}),
  deleteSubTask: vi.fn().mockResolvedValue({}),
  getAttachments: vi.fn().mockResolvedValue([]),
}))

const baseTodo = {
  id: 1,
  title: 'テストタスク',
  description: 'テストの説明',
  notes: null,
  priority: 'medium',
  status: 'todo',
  completed: false,
  archived: false,
  due_date: null,
  due_time: null,
  recurrence: 'none',
  tags: [],
  subtask_count: 0,
  completed_subtask_count: 0,
  created_at: '2025-01-01T00:00:00',
}

function renderTodoItem(overrides = {}, callbacks = {}) {
  const todo = { ...baseTodo, ...overrides }
  return render(
    <TodoItem
      todo={todo}
      tags={[]}
      listMembers={[]}
      selected={false}
      onSelect={vi.fn()}
      onUpdate={callbacks.onUpdate ?? vi.fn()}
      onDelete={callbacks.onDelete ?? vi.fn()}
      onDuplicate={callbacks.onDuplicate ?? vi.fn()}
      dragHandleProps={{}}
    />
  )
}

// ── 表示のテスト ──────────────────────────────────────────

describe('TodoItem 表示', () => {
  it('タイトルが表示される', () => {
    renderTodoItem()
    expect(screen.getByText('テストタスク')).toBeInTheDocument()
  })

  it('説明が表示される', () => {
    renderTodoItem()
    expect(screen.getByText('テストの説明')).toBeInTheDocument()
  })

  it('優先度バッジが表示される（中）', () => {
    renderTodoItem({ priority: 'medium' })
    expect(screen.getByText('中')).toBeInTheDocument()
  })

  it('高優先度のバッジが表示される', () => {
    renderTodoItem({ priority: 'high' })
    expect(screen.getByText('高')).toBeInTheDocument()
  })

  it('ステータスバッジ「未着手」が表示される', () => {
    renderTodoItem({ status: 'todo' })
    expect(screen.getByText('未着手')).toBeInTheDocument()
  })

  it('ステータスバッジ「進行中」が表示される', () => {
    renderTodoItem({ status: 'in_progress' })
    expect(screen.getByText('進行中')).toBeInTheDocument()
  })

  it('ステータスバッジ「完了」が表示される', () => {
    renderTodoItem({ status: 'done' })
    // 「完了」ボタンと重複するため span 要素に絞って検索
    expect(screen.getByText('完了', { selector: 'span' })).toBeInTheDocument()
  })

  it('completed=true のとき .completed クラスがつく', () => {
    const { container } = renderTodoItem({ completed: true })
    expect(container.querySelector('.todo-item')).toHaveClass('completed')
  })
})

// ── インタラクションのテスト ──────────────────────────────

describe('TodoItem インタラクション', () => {
  it('編集ボタンを押すと編集フォームが開く', () => {
    renderTodoItem()
    // title 属性なしでテキスト「編集」の button を選択
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    // 編集フォームのセーブ・キャンセルボタンが現れる
    expect(screen.getByText('保存')).toBeInTheDocument()
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('編集フォームのキャンセルで表示モードに戻る', () => {
    renderTodoItem()
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.getByText('テストタスク')).toBeInTheDocument()
    expect(screen.queryByText('保存')).not.toBeInTheDocument()
  })
})
