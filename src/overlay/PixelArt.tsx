import { memo } from 'react'
import { PALETTE } from '../sprites/ghost'

type Run = { x: number; y: number; width: number; fill: string }

// 같은 색이 이어지는 가로 구간을 rect 하나로 합친다
function toRuns(rows: string[]): Run[] {
  const runs: Run[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const fill = PALETTE[row[x]]
      let end = x + 1
      while (end < row.length && row[end] === row[x]) end++
      if (fill) runs.push({ x, y, width: end - x, fill })
      x = end
    }
  })
  return runs
}

const cache = new Map<string[], Run[]>()

// 픽셀 매트릭스를 SVG로 — 유령 몸통과 머리 위 아이콘이 함께 쓴다
function PixelArt({ rows, className }: { rows: string[]; className: string }): React.JSX.Element {
  let runs = cache.get(rows)
  if (!runs) {
    runs = toRuns(rows)
    cache.set(rows, runs)
  }
  return (
    <svg
      className={className}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {runs.map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.fill}
        />
      ))}
    </svg>
  )
}

export default memo(PixelArt)
