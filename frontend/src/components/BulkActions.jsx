export default function BulkActions({ todos, selectedIds, onSelectAll, onBulkComplete, onBulkDelete, onBulkArchive, showArchived }) {
  const allSelected = todos.length > 0 && selectedIds.size === todos.length

  return (
    <div className="bulk-actions">
      <label className="bulk-select-all">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={e => onSelectAll(e.target.checked)}
        />
        全選択
      </label>
      {selectedIds.size > 0 && (
        <>
          <span className="bulk-count">{selectedIds.size}件選択中</span>
          <button className="btn-bulk-complete" onClick={onBulkComplete}>一括完了</button>
          <button className="btn-bulk-archive" onClick={onBulkArchive}>{showArchived ? '一括復元' : '一括アーカイブ'}</button>
          <button className="btn-bulk-delete" onClick={onBulkDelete}>一括削除</button>
        </>
      )}
    </div>
  )
}
