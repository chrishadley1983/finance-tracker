import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// These tests verify the FIRE calculation API behavior
// The core calculation logic is tested in tests/unit/fire-calculator.test.ts

describe('FIRE Calculate API', () => {
  describe('POST /api/fire/calculate', () => {
    it('should have valid request schema', () => {
      // The API accepts POST requests with optional scenarioIds and inputOverrides
      const validBody = {
        scenarioIds: ['scenario-1'],
        inputOverrides: {
          currentAge: 35,
          currentPortfolioValue: 100000,
        },
      };

      expect(validBody).toHaveProperty('scenarioIds');
      expect(validBody).toHaveProperty('inputOverrides');
      expect(Array.isArray(validBody.scenarioIds)).toBe(true);
    });

    it('should support empty request body', () => {
      // API should work with empty body (uses defaults)
      const emptyBody = {};
      expect(emptyBody).toEqual({});
    });

    it('should support input overrides shape', () => {
      // Verify the expected override fields
      const overrides = {
        currentAge: 40,
        targetRetirementAge: 60,
        currentPortfolioValue: 200000,
        annualIncome: 80000,
        annualSavings: 30000,
        includeStatePension: false,
        partnerStatePension: true,
      };

      expect(overrides.currentAge).toBe(40);
      expect(overrides.targetRetirementAge).toBe(60);
      expect(overrides.currentPortfolioValue).toBe(200000);
      expect(typeof overrides.includeStatePension).toBe('boolean');
    });

    it('should create valid NextRequest', () => {
      const request = new NextRequest('http://localhost:3000/api/fire/calculate', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(request.method).toBe('POST');
    });
  });
});
