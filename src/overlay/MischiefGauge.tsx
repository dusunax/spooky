// 레퍼런스 시트 GAUGE: 빈 칸 → 파랑 → 초록 → 노랑 → 주황 → 빨강, 가득 차면 점멸 (PRD §3.2)
function levelOf(gauge: number): string {
  if (gauge >= 90) return 'red'
  if (gauge >= 70) return 'orange'
  if (gauge >= 50) return 'yellow'
  if (gauge >= 25) return 'green'
  return 'blue'
}

function MischiefGauge({ gauge }: { gauge: number }): React.JSX.Element {
  return (
    <div
      className="gauge"
      data-level={levelOf(gauge)}
      data-full={gauge >= 100 || undefined}
      role="meter"
      aria-label="Mischief"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={gauge}
    >
      {/* 차오를 때만 부드럽게, 0으로 리셋될 때는 바로 비운다 */}
      <div
        className="gauge-fill"
        style={{ width: `${gauge}%`, transition: gauge === 0 ? 'none' : undefined }}
      />
    </div>
  )
}

export default MischiefGauge
