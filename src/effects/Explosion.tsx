import './explosion.css'

// 레퍼런스 시트 BUTTON EXPLOSION을 단순화: 섬광 → 픽셀 파편 + 연기
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2
  const distance = 34 + (i % 3) * 14
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    color: ['#ffd84d', '#ffa94d', '#ff6f91', '#ffffff'][i % 4]
  }
})

const SMOKE = [
  { dx: -14, dy: -10 },
  { dx: 12, dy: -14 },
  { dx: 0, dy: 10 }
]

type Props = {
  x: number
  y: number
  large?: boolean // 외부 앱 버튼 위 연출 — 그을린 버튼 같은 흔적이 없어서 크고 길게
}

function Explosion({ x, y, large = false }: Props): React.JSX.Element {
  return (
    <div
      className={large ? 'explosion explosion--large' : 'explosion'}
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <span className="flash" />
      {large && <span className="boom-text">BOOM!</span>}
      {SMOKE.map((s, i) => (
        <span
          key={`smoke-${i}`}
          className="smoke"
          style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as React.CSSProperties}
        />
      ))}
      {SPARKS.map((s, i) => (
        <span
          key={`spark-${i}`}
          className="spark"
          style={
            { '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, background: s.color } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export default Explosion
