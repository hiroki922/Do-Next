export default function Pagination({ page, pages, total, perPage, onPageChange }) {
  if (pages <= 1) return null
  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>←</button>
      <span className="page-info">{page} / {pages} ページ（{start}–{end} / {total}件）</span>
      <button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>→</button>
    </div>
  )
}
