// 자리 표시 — 유령 렌더·추적은 PRD §14 구현 순서 2단계에서 채운다.
function Overlay(): React.JSX.Element {
  return (
    <div className="ghost-placeholder">
      <span className="status">Ghosty ready</span>
    </div>
  )
}

export default Overlay
