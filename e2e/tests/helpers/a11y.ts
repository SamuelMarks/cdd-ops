import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Runs axe-core accessibility checks against the current page state.
 * Enforces WCAG 2.0 AA and WCAG 2.1 AA standards to comply with accessibility requirements.
 * 
 * @param page - The Playwright Page object representing the current browser context.
 */
export async function checkA11y(page: Page): Promise<void> {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // If there are violations, this will print them clearly in the test runner output
  expect(accessibilityScanResults.violations).toEqual([]);
}
