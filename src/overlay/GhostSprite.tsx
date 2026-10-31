import { memo } from 'react'
import { GHOST_FRAMES, PALETTE, type GhostFrame } from '../sprites/ghost'

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

const RUNS: Record<GhostFrame, Run[]> = {
  idle: toRuns(GHOST_FRAMES.idle),
  boo: toRuns(GHOST_FRAMES.boo)
}

function GhostSprite({ frame }: { frame: GhostFrame }): React.JSX.Element {
  return (
    <svg className="sprite" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {RUNS[frame].map((run) => (
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

export default memo(GhostSprite)
