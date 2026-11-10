import { describe, expect, it } from 'vitest'
import { distanceToRect } from './distance'

const rect = { x: 100, y: 100, width: 80, height: 30 }

describe('distanceToRect', () => {
  it('is 0 inside the rect', () => {
    expect(distanceToRect({ x: 120, y: 110 }, rect)).toBe(0)
  })

  it('measures straight out from an edge', () => {
    expect(distanceToRect({ x: 140, y: 60 }, rect)).toBe(40)
    expect(distanceToRect({ x: 200, y: 115 }, rect)).toBe(20)
  })

  it('measures to the nearest corner diagonally', () => {
    expect(distanceToRect({ x: 70, y: 60 }, rect)).toBe(50)
  })
})
