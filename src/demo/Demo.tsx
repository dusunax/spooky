// 폭파 대상 버튼 — 실제 동작 없음. 폭파·복구 연출은 PRD §14 구현 순서 6단계에서 채운다.
const TARGETS = [
  { id: 'btn-save', label: 'Save' },
  { id: 'btn-submit', label: 'Submit' },
  { id: 'btn-delete', label: 'Delete Everything' }
] as const

function Demo(): React.JSX.Element {
  return (
    <main className="demo">
      <p className="hint">Ghosty may haunt these buttons.</p>
      <div className="buttons">
        {TARGETS.map((target) => (
          <button key={target.id} type="button" data-ghost-target={target.id}>
            {target.label}
          </button>
        ))}
      </div>
    </main>
  )
}

export default Demo
