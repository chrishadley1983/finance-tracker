import { describe, it, expect } from 'vitest';
import {
  calculateTargetNumber,
  adjustForInflation,
  calculateSafeWithdrawal,
  calculateCoastFi,
  calculateFireProjection,
  calculateMultipleScenarios,
  formatCurrency,
} from '@/lib/fire/calculator';
import type { FireScenario, FireInputs } from '@/lib/types/fire';

describe('FIRE Calculator', () => {
  // =============================================================================
  // calculateTargetNumber
  // =============================================================================
  describe('calculateTargetNumber', () => {
    it('calculates correct target with 4% withdrawal rate', () => {
      // £40,000 annual spend / 4% = £1,000,000
      const result = calculateTargetNumber(40000, 4);
      expect(result).toBe(1000000);
    });

    it('calculates correct target with 3% withdrawal rate', () => {
      // £30,000 annual spend / 3% = £1,000,000
      const result = calculateTargetNumber(30000, 3);
      expect(result).toBe(1000000);
    });

    it('calculates correct target with 3.5% withdrawal rate', () => {
      // £35,000 annual spend / 3.5% = £1,000,000
      const result = calculateTargetNumber(35000, 3.5);
      expect(result).toBeCloseTo(1000000, 0);
    });

    it('handles small annual spend', () => {
      const result = calculateTargetNumber(20000, 4);
      expect(result).toBe(500000);
    });

    it('handles large annual spend', () => {
      const result = calculateTargetNumber(100000, 4);
      expect(result).toBe(2500000);
    });
  });

  // =============================================================================
  // adjustForInflation
  // =============================================================================
  describe('adjustForInflation', () => {
    it('adjusts correctly for 1 year at 3%', () => {
      const result = adjustForInflation(100, 1, 3);
      expect(result).toBeCloseTo(103, 2);
    });

    it('adjusts correctly for 10 years at 2%', () => {
      // 100 * (1.02)^10 ≈ 121.90
      const result = adjustForInflation(100, 10, 2);
      expect(result).toBeCloseTo(121.90, 1);
    });

    it('adjusts correctly for 20 years at 3%', () => {
      // 1000 * (1.03)^20 ≈ 1806.11
      const result = adjustForInflation(1000, 20, 3);
      expect(result).toBeCloseTo(1806.11, 0);
    });

    it('returns same amount for 0 years', () => {
      const result = adjustForInflation(100, 0, 3);
      expect(result).toBe(100);
    });

    it('returns same amount for 0% inflation', () => {
      const result = adjustForInflation(100, 10, 0);
      expect(result).toBe(100);
    });
  });

  // =============================================================================
  // calculateSafeWithdrawal
  // =============================================================================
  describe('calculateSafeWithdrawal', () => {
    it('calculates 4% withdrawal correctly', () => {
      const result = calculateSafeWithdrawal(1000000, 4);
      expect(result).toBe(40000);
    });

    it('calculates 3.5% withdrawal correctly', () => {
      const result = calculateSafeWithdrawal(1000000, 3.5);
      expect(result).toBe(35000);
    });

    it('handles zero portfolio', () => {
      const result = calculateSafeWithdrawal(0, 4);
      expect(result).toBe(0);
    });

    it('handles large portfolio', () => {
      const result = calculateSafeWithdrawal(5000000, 4);
      expect(result).toBe(200000);
    });
  });

  // =============================================================================
  // calculateCoastFi
  // =============================================================================
  describe('calculateCoastFi', () => {
    it('returns null if retirement age <= current age', () => {
      const result = calculateCoastFi(100000, 1000000, 7, 65, 60);
      expect(result).toBeNull();
    });

    it('returns null if same age', () => {
      const result = calculateCoastFi(100000, 1000000, 7, 65, 65);
      expect(result).toBeNull();
    });

    it('calculates coast FI number correctly', () => {
      // With 7% return over 20 years, to reach £1M target:
      // Coast FI = 1000000 / (1.07)^20 ≈ £258,419
      const result = calculateCoastFi(100000, 1000000, 7, 35, 55);
      expect(result).not.toBeNull();
      expect(result!.coastFiNumber).toBeCloseTo(258419, -2);
    });

    it('identifies when already past coast FI', () => {
      // Current value £500,000 is already above coast FI number
      const result = calculateCoastFi(500000, 1000000, 7, 35, 55);
      expect(result).not.toBeNull();
      // Should return current age since already reached
      expect(result!.coastFiAge).toBeLessThanOrEqual(35);
    });

    it('returns retirement age when not yet at coast FI', () => {
      // Current value £50,000 is below coast FI number
      const result = calculateCoastFi(50000, 1000000, 7, 35, 55);
      expect(result).not.toBeNull();
      expect(result!.coastFiAge).toBe(55);
    });
  });

  // =============================================================================
  // calculateFireProjection
  // =============================================================================
  describe('calculateFireProjection', () => {
    const baseScenario: FireScenario = {
      id: 'test-scenario',
      name: 'Test Scenario',
      description: 'A test scenario',
      annualSpend: 40000,
      withdrawalRate: 4,
      expectedReturn: 7,
      inflationRate: 2.5,
      retirementAge: 55,
      statePensionAge: 67,
      statePensionAnnual: 11500,
      isDefault: true,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const baseInputs: FireInputs = {
      id: 'test-inputs',
      currentAge: 35,
      targetRetirementAge: 55,
      currentPortfolioValue: 100000,
      annualIncome: 60000,
      annualSavings: 20000,
      includeStatePension: true,
      partnerStatePension: false,
      updatedAt: new Date().toISOString(),
    };

    it('returns correct result shape', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 10);

      expect(result).toHaveProperty('scenario');
      expect(result).toHaveProperty('inputs');
      expect(result).toHaveProperty('projections');
      expect(result).toHaveProperty('fiAge');
      expect(result).toHaveProperty('fiYear');
      expect(result).toHaveProperty('coastFiAge');
      expect(result).toHaveProperty('coastFiNumber');
      expect(result).toHaveProperty('targetNumber');
      expect(result).toHaveProperty('yearsToFi');
      expect(result).toHaveProperty('successRate');
    });

    it('calculates target number correctly', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 10);
      // £40,000 / 4% = £1,000,000
      expect(result.targetNumber).toBe(1000000);
    });

    it('generates correct number of projections', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 30);
      // Should have 30 years of projections (or less if portfolio depletes)
      expect(result.projections.length).toBeLessThanOrEqual(30);
      expect(result.projections.length).toBeGreaterThan(0);
    });

    it('starts with correct portfolio value', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 10);
      expect(result.projections[0].portfolioStart).toBe(100000);
    });

    it('applies contributions while accumulating', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 5);
      // Before retirement (age 35-39), should have contributions
      expect(result.projections[0].contributions).toBe(20000);
    });

    it('stops contributions after retirement', () => {
      const inputsNearRetirement: FireInputs = {
        ...baseInputs,
        currentAge: 54,
        currentPortfolioValue: 900000,
      };
      const result = calculateFireProjection(inputsNearRetirement, baseScenario, 5);

      // Year 0 (age 54): still contributing
      expect(result.projections[0].contributions).toBe(20000);

      // Year 1 (age 55): retirement starts, no contributions
      expect(result.projections[1].contributions).toBe(0);
    });

    it('applies withdrawals after retirement', () => {
      const inputsNearRetirement: FireInputs = {
        ...baseInputs,
        currentAge: 54,
        currentPortfolioValue: 900000,
      };
      const result = calculateFireProjection(inputsNearRetirement, baseScenario, 5);

      // Year 0 (age 54): no withdrawals
      expect(result.projections[0].withdrawals).toBe(0);

      // Year 1 (age 55): withdrawals start
      expect(result.projections[1].withdrawals).toBeGreaterThan(0);
    });

    it('includes state pension after state pension age', () => {
      const inputsNearStatePension: FireInputs = {
        ...baseInputs,
        currentAge: 66,
        targetRetirementAge: 55, // Already retired
        currentPortfolioValue: 500000,
        includeStatePension: true,
      };
      const result = calculateFireProjection(inputsNearStatePension, baseScenario, 5);

      // Year 0 (age 66): no state pension yet
      expect(result.projections[0].statePension).toBe(0);

      // Year 1 (age 67): state pension starts
      expect(result.projections[1].statePension).toBe(11500);
    });

    it('doubles state pension with partner', () => {
      const inputsWithPartner: FireInputs = {
        ...baseInputs,
        currentAge: 67,
        targetRetirementAge: 55,
        currentPortfolioValue: 500000,
        includeStatePension: true,
        partnerStatePension: true,
      };
      const result = calculateFireProjection(inputsWithPartner, baseScenario, 3);

      // Age 67+: should have double state pension
      expect(result.projections[0].statePension).toBe(23000);
    });

    it('identifies FI reached when portfolio hits target', () => {
      const inputsNearFi: FireInputs = {
        ...baseInputs,
        currentAge: 35,
        currentPortfolioValue: 950000, // Close to £1M target
        annualSavings: 50000,
      };
      const result = calculateFireProjection(inputsNearFi, baseScenario, 10);

      expect(result.fiAge).not.toBeNull();
      expect(result.fiYear).not.toBeNull();
      expect(result.yearsToFi).not.toBeNull();
    });

    it('handles zero portfolio value', () => {
      const inputsZero: FireInputs = {
        ...baseInputs,
        currentPortfolioValue: 0,
      };
      const result = calculateFireProjection(inputsZero, baseScenario, 10);

      expect(result.projections[0].portfolioStart).toBe(0);
      expect(result.projections.length).toBeGreaterThan(0);
    });

    it('handles null portfolio value', () => {
      const inputsNull: FireInputs = {
        ...baseInputs,
        currentPortfolioValue: null,
      };
      const result = calculateFireProjection(inputsNull, baseScenario, 10);

      expect(result.projections[0].portfolioStart).toBe(0);
    });

    it('calculates success rate correctly', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 60);

      expect(result.successRate).toBeGreaterThanOrEqual(0);
      expect(result.successRate).toBeLessThanOrEqual(100);
    });

    it('marks status as depleted when portfolio runs out', () => {
      const inputsWillDeplete: FireInputs = {
        ...baseInputs,
        currentAge: 55,
        currentPortfolioValue: 50000, // Too small to sustain
        annualSavings: 0,
      };
      const scenarioHighSpend: FireScenario = {
        ...baseScenario,
        annualSpend: 100000,
        retirementAge: 55,
      };

      const result = calculateFireProjection(inputsWillDeplete, scenarioHighSpend, 60);

      // Should stop when depleted
      const lastProjection = result.projections[result.projections.length - 1];
      expect(lastProjection.fiStatus).toBe('depleted');
    });

    it('adjusts spending for inflation over time', () => {
      const result = calculateFireProjection(baseInputs, baseScenario, 20);

      // Year 0: base spend
      expect(result.projections[0].annualSpendInflated).toBe(40000);

      // Year 10: should be higher due to inflation
      expect(result.projections[10].annualSpendInflated).toBeGreaterThan(40000);
    });
  });

  // =============================================================================
  // calculateMultipleScenarios
  // =============================================================================
  describe('calculateMultipleScenarios', () => {
    const inputs: FireInputs = {
      id: 'test',
      currentAge: 35,
      targetRetirementAge: 55,
      currentPortfolioValue: 100000,
      annualIncome: 60000,
      annualSavings: 20000,
      includeStatePension: true,
      partnerStatePension: false,
      updatedAt: new Date().toISOString(),
    };

    const scenarios: FireScenario[] = [
      {
        id: 'lean',
        name: 'Lean',
        description: 'Minimal spending',
        annualSpend: 25000,
        withdrawalRate: 4,
        expectedReturn: 7,
        inflationRate: 2.5,
        retirementAge: 55,
        statePensionAge: 67,
        statePensionAnnual: 11500,
        isDefault: false,
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'medium',
        name: 'Medium',
        description: 'Comfortable spending',
        annualSpend: 40000,
        withdrawalRate: 4,
        expectedReturn: 7,
        inflationRate: 2.5,
        retirementAge: 55,
        statePensionAge: 67,
        statePensionAnnual: 11500,
        isDefault: true,
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      },
    ];

    it('returns results for all scenarios', () => {
      const results = calculateMultipleScenarios(inputs, scenarios);
      expect(results).toHaveLength(2);
    });

    it('returns different target numbers for different spend levels', () => {
      const results = calculateMultipleScenarios(inputs, scenarios);
      expect(results[0].targetNumber).toBeLessThan(results[1].targetNumber);
    });

    it('handles empty scenarios array', () => {
      const results = calculateMultipleScenarios(inputs, []);
      expect(results).toHaveLength(0);
    });
  });

  // =============================================================================
  // formatCurrency
  // =============================================================================
  describe('formatCurrency', () => {
    it('formats positive whole numbers', () => {
      const result = formatCurrency(1000000);
      expect(result).toContain('1,000,000');
    });

    it('formats negative numbers', () => {
      const result = formatCurrency(-50000);
      expect(result).toContain('50,000');
      expect(result).toContain('-');
    });

    it('rounds to whole numbers', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1,235');
    });

    it('includes currency symbol', () => {
      const result = formatCurrency(100);
      expect(result).toContain('£');
    });

    it('handles zero', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });
  });
});
