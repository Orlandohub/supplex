/**
 * Risk Calculation Utility
 * Shared logic for calculating workflow risk scores
 *
 * Formula: Weighted average across 4 risk categories
 * - Geographic Risk: 30% weight
 * - Financial Risk: 25% weight
 * - Quality Risk: 30% weight
 * - Delivery Risk: 15% weight
 *
 * Risk Levels:
 * - Low = 1
 * - Medium = 2
 * - High = 3
 *
 * Range: 1.00 (all low) to 3.00 (all high)
 */

import { RiskLevel } from "../models/qualification-workflow";

/**
 * Risk Level to Numeric Value Mapping
 */
export const RISK_VALUES: Record<RiskLevel, number> = {
  [RiskLevel.LOW]: 1,
  [RiskLevel.MEDIUM]: 2,
  [RiskLevel.HIGH]: 3,
};

/**
 * Risk Category Weights
 */
export const RISK_WEIGHTS = {
  geographic: 0.3,
  financial: 0.25,
  quality: 0.3,
  delivery: 0.15,
} as const;

/**
 * Calculate Overall Risk Score
 *
 * @param riskAssessment - Individual risk levels for each category
 * @returns Risk score as string with 2 decimal places (1.00 - 3.00)
 *
 * @example
 * ```typescript
 * const score = calculateRiskScore({
 *   geographic: RiskLevel.LOW,
 *   financial: RiskLevel.MEDIUM,
 *   quality: RiskLevel.LOW,
 *   delivery: RiskLevel.LOW
 * });
 * // Returns: "1.25"
 * ```
 */
export function calculateRiskScore(riskAssessment: {
  geographic: RiskLevel | string;
  financial: RiskLevel | string;
  quality: RiskLevel | string;
  delivery: RiskLevel | string;
}): string {
  const geoValue = RISK_VALUES[riskAssessment.geographic as RiskLevel];
  const finValue = RISK_VALUES[riskAssessment.financial as RiskLevel];
  const qualValue = RISK_VALUES[riskAssessment.quality as RiskLevel];
  const delValue = RISK_VALUES[riskAssessment.delivery as RiskLevel];

  const score =
    geoValue * RISK_WEIGHTS.geographic +
    finValue * RISK_WEIGHTS.financial +
    qualValue * RISK_WEIGHTS.quality +
    delValue * RISK_WEIGHTS.delivery;

  return score.toFixed(2);
}

/**
 * Get Risk Score Color Classification
 *
 * @param score - Risk score (1.00 - 3.00)
 * @returns Color classification: 'green' | 'yellow' | 'red'
 *
 * Thresholds:
 * - Green: < 1.5 (Low overall risk)
 * - Yellow: 1.5 - 2.5 (Medium overall risk)
 * - Red: > 2.5 (High overall risk)
 */
export function getRiskScoreColor(
  score: string | number
): "green" | "yellow" | "red" {
  const numScore = typeof score === "string" ? parseFloat(score) : score;

  if (numScore < 1.5) return "green";
  if (numScore <= 2.5) return "yellow";
  return "red";
}

/**
 * Get Risk Score CSS Class for Tailwind
 *
 * @param score - Risk score (1.00 - 3.00)
 * @returns Tailwind CSS classes for text and background colors
 */
export function getRiskScoreClassName(score: string | number): string {
  const color = getRiskScoreColor(score);

  const classNames = {
    green: "text-green-600 bg-green-50",
    yellow: "text-yellow-600 bg-yellow-50",
    red: "text-red-600 bg-red-50",
  };

  return classNames[color];
}
