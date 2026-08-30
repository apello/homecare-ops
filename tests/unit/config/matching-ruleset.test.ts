import { describe, expect, it } from 'vitest'
import ruleset from '@/lib/config/matching-ruleset-v1.json'

describe('matching ruleset v1', () => {
  it('allocates the full score across matching factors', () => {
    const totalWeight = Object.values(ruleset.weights).reduce(
      (total, weight) => total + weight,
      0,
    )

    expect(totalWeight).toBe(1)
  })

  it('keeps review thresholds within their hard limits', () => {
    expect(ruleset.travel.preferred_minutes).toBeLessThan(
      ruleset.travel.review_threshold_minutes,
    )
    expect(ruleset.travel.review_threshold_minutes).toBeLessThanOrEqual(
      ruleset.travel.max_minutes,
    )
    expect(ruleset.score_thresholds.review_required).toBeLessThan(
      ruleset.score_thresholds.recommended,
    )
    expect(ruleset.availability.min_overlap_pct).toBeLessThanOrEqual(
      ruleset.availability.review_overlap_pct,
    )
  })
})
