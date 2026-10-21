/**
 * @file Axe-core accessibility assertion helpers for Playwright E2E tests.
 * @module e2e/tests/helpers/a11y
 */

import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Runs axe-core accessibility checks against the current page state.
 * Enforces WCAG 2.0 AA and WCAG 2.1 AA standards to comply with accessibility requirements.
 * @param page - The Playwright Page object representing the current browser context.
 * @returns A promise that resolves when accessibility assertions complete.
 */
export async function checkA11y(page: Page): Promise<void> {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
}
