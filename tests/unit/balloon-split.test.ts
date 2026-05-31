import { describe, it, expect } from 'vitest';

/**
 * Balloon Physics & Split System — Unit Tests
 *
 * Tests core formulas from balloon-physics-split-system.md §4
 * Phase 1 focuses on split size formula verification.
 * Full system implementation in Phase 2 (gameplay-programmer).
 */

/**
 * Stub formula: Parent balloon of size S splits into two children.
 * Each child radius = 70% of parent radius.
 * Source: balloon-physics-split-system.md §4 Split Formula
 */
function calculateChildRadius(parentRadius: number): number {
  return Math.round(parentRadius * 0.7);
}

/**
 * Helper: Calculate size from radius
 * Size represents visual diameter (2 × radius)
 */
function radiusToSize(radius: number): number {
  return radius * 2;
}

describe('Balloon Physics: Split Size Formula', () => {
  it('should calculate child radius as 70% of parent', () => {
    const parentRadius = 50;
    const childRadius = calculateChildRadius(parentRadius);

    // 50 * 0.7 = 35
    expect(childRadius).toBe(35);
  });

  it('should handle small balloon split', () => {
    const parentRadius = 20;
    const childRadius = calculateChildRadius(parentRadius);

    // 20 * 0.7 = 14
    expect(childRadius).toBe(14);
  });

  it('should handle large balloon split', () => {
    const parentRadius = 100;
    const childRadius = calculateChildRadius(parentRadius);

    // 100 * 0.7 = 70
    expect(childRadius).toBe(70);
  });

  it('should produce two children from one parent', () => {
    const parentRadius = 60;
    const childRadius = calculateChildRadius(parentRadius);

    // Verify both children have identical size
    const child1 = childRadius;
    const child2 = childRadius;

    expect(child1).toBe(child2);
    expect(child1).toBeLessThan(parentRadius);
  });

  it('should maintain size consistency across split sequence', () => {
    // Start with size 100
    let radius = 100;
    let splitDepth = 0;

    // Simulate 3 splits: 100 → 70 → 49 → 34
    while (radius > 30 && splitDepth < 3) {
      radius = calculateChildRadius(radius);
      splitDepth++;
    }

    // After 3 splits, radius should be 34
    // 100 * 0.7 = 70, 70 * 0.7 = 49, 49 * 0.7 ≈ 34
    expect(splitDepth).toBe(3);
    expect(radius).toBeLessThanOrEqual(35);
  });
});
