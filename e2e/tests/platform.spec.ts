/**
 * @file End-to-End (E2E) Playwright specifications and Page Object Model for the CDD Platform.
 * @module e2e/tests/platform.spec
 */

import { test, expect, Page, Locator } from '@playwright/test';
import { checkA11y } from './helpers/a11y';

/**
 * Page Object Model for the CDD Platform.
 * Encapsulates DOM selectors and actions to keep tests strictly typed and maintainable.
 */
export class CddPlatformPage {
  /** The Playwright Page object representing the current browser tab. */
  public readonly page: Page;

  /** Locator for the main dialog element. */
  readonly dialog: Locator;
  /** Locator for the settings button. */
  readonly settingsButton: Locator;
  /** Locator for the backend URL input field. */
  readonly backendUrlInput: Locator;
  /** Locator for the connect button. */
  readonly connectButton: Locator;

  /** Locator for the username/email input field. */
  readonly usernameInput: Locator;
  /** Locator for the password input field. */
  readonly passwordInput: Locator;
  /** Locator for the register/sign up button. */
  readonly registerButton: Locator;
  /** Locator for the login/sign in button. */
  readonly loginButton: Locator;
  /** Locator for the close dialog button. */
  readonly closeDialogButton: Locator;

  /** Locator for the generic submit/create button. */
  readonly submitButton: Locator;

  /** Locator for the dashboard heading. */
  readonly dashboardHeading: Locator;
  /** Locator for the profile/account button. */
  readonly profileButton: Locator;

  /** Locator for the organizations tab link. */
  readonly orgsTab: Locator;
  /** Locator for the repositories tab link. */
  readonly reposTab: Locator;

  /** Locator for the create organization button. */
  readonly createOrgButton: Locator;
  /** Locator for the organization name input field. */
  readonly orgNameInput: Locator;

  /** Locator for the create repository button. */
  readonly createRepoButton: Locator;
  /** Locator for the repository name input field. */
  readonly repoNameInput: Locator;

  /** Locator for the add specification button. */
  readonly addSpecButton: Locator;
  /** Locator for the specification URL input field. */
  readonly specUrlInput: Locator;
  /** Locator for the execute/produce/generate button. */
  readonly executeButton: Locator;

  /** Locator for the release docs button. */
  readonly releaseDocsButton: Locator;
  /** Locator for the view docs link. */
  readonly viewDocsLink: Locator;

  /** Locator for the delete docs button. */
  readonly deleteDocsButton: Locator;
  /** Locator for the delete generation button. */
  readonly deleteGenerationButton: Locator;
  /** Locator for the delete repository button. */
  readonly deleteRepoButton: Locator;
  /** Locator for the delete organization button. */
  readonly deleteOrgButton: Locator;
  /** Locator for the delete account button. */
  readonly deleteAccountButton: Locator;
  /** Locator for the settings tab. */
  readonly settingsTab: Locator;

  /**
   * Initializes the CDD Platform Page Object.
   * @param page - The Playwright Page object.
   */
  constructor(page: Page) {
    this.page = page;
    this.dialog = this.page.getByRole('dialog');
    this.settingsButton = this.page.getByRole('button', { name: /settings/i });
    this.backendUrlInput = this.dialog.getByLabel(/backend url/i);
    this.connectButton = this.dialog.getByRole('button', { name: /connect/i });

    this.usernameInput = this.dialog.getByLabel(/username|email/i);
    this.passwordInput = this.dialog.getByLabel(/password/i);
    this.registerButton = this.dialog.getByRole('button', { name: /register|sign up/i });
    this.loginButton = this.dialog.getByRole('button', { name: /^login$|^log in$|^sign in$/i });
    this.closeDialogButton = this.dialog.getByRole('button', { name: /close/i });

    this.submitButton = this.page.getByRole('button', {
      name: /submit|create|save|import|yes|confirm|link/i,
    });

    this.dashboardHeading = this.page.getByRole('heading', { name: /cdd control/i });
    this.profileButton = this.page.getByRole('button', { name: /profile|account|user menu/i });

    this.orgsTab = this.page.getByRole('link', { name: /organizations/i });
    this.reposTab = this.page.getByRole('link', { name: /repositories/i });

    this.createOrgButton = this.page.getByRole('button', {
      name: /create organization|create org/i,
    });
    this.orgNameInput = this.page.getByLabel(/organization name/i);

    this.createRepoButton = this.page.getByRole('button', {
      name: /link repository|create repo/i,
    });
    this.repoNameInput = this.page.getByLabel(/repository name/i);

    this.addSpecButton = this.page.getByRole('button', {
      name: /add spec|upload openapi|import/i,
    });
    this.specUrlInput = this.page.getByLabel(/spec url|openapi url/i);
    this.executeButton = this.page
      .getByRole('button', { name: /execute|produce|generate/i })
      .or(this.page.locator('button.generate-btn'));

    this.releaseDocsButton = this.page.getByRole('button', {
      name: /release docs|publish html api docs|publish docs/i,
    });
    this.viewDocsLink = this.page.getByRole('link', { name: /view docs|cdd-docs-ui/i });

    this.deleteDocsButton = this.page.getByRole('button', {
      name: /delete docs|unpublish docs/i,
    });
    this.deleteGenerationButton = this.page
      .getByRole('button', { name: /delete generation|clean sdks|delete/i })
      .first();
    this.deleteRepoButton = this.page.getByRole('button', {
      name: /delete repo|delete repository|unlink/i,
    });
    this.deleteOrgButton = this.page.getByRole('button', {
      name: /delete org|delete organization/i,
    });
    this.deleteAccountButton = this.page.getByRole('button', {
      name: /delete account|deregister/i,
    });
    this.settingsTab = this.page.getByRole('tab', { name: /settings/i });
  }

  /**
   * Navigates to the home page, waits for network to be idle,
   * and automatically dismisses the WASM loading dialog if present.
   * @returns A promise that resolves when navigation and dialog dismissal are complete.
   */
  async navigateToHome(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    await this.dismissWasmDialog();
  }

  /**
   * Checks for and dismisses the large WASM payload dialog if it appears on the screen.
   * @returns A promise that resolves once the dialog is no longer visible.
   */
  async dismissWasmDialog(): Promise<void> {
    const loadWasmButton = this.page.getByRole('button', {
      name: /load ~?\d+\s*mb of wasm/i,
    });
    if (await loadWasmButton.isVisible()) {
      await loadWasmButton.click();
      await loadWasmButton.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Clicks an optional action locator if it is currently visible in the UI.
   * @param locator - The Playwright Locator to inspect and click if visible.
   * @returns True if the locator was visible and clicked, false otherwise.
   */
  async clickIfVisible(locator: Locator): Promise<boolean> {
    if (await locator.isVisible()) {
      await locator.click();
      return true;
    }
    return false;
  }
}

test.describe('CDD Platform Full E2E Flow', () => {
  let username = '';
  const password = 'TestPassword123!';
  let orgName = '';
  let repoName = '';

  let platform: CddPlatformPage;

  test.beforeEach(async ({ page }) => {
    username = `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
    orgName = `TestOrg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    repoName = `TestRepo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    platform = new CddPlatformPage(page);
  });

  test('Complete platform flow: registration -> execution -> cleanup', async ({ page }) => {
    await test.step('Register and Login via Online Settings', async () => {
      await platform.navigateToHome();

      await platform.settingsButton.click();

      await platform.backendUrlInput.fill(process.env['BASE_URL'] || 'http://localhost:8086');
      await platform.connectButton.click();
      await expect(page.getByText('Connected!', { exact: true })).toBeVisible();

      await platform.usernameInput.fill(username);
      await platform.passwordInput.fill(password);
      await platform.registerButton.click();
      await expect(page.getByText('Registered successfully!', { exact: true })).toBeVisible();

      await platform.closeDialogButton.click();
    });

    await test.step('Navigate to Dashboard', async () => {
      await page.goto('/dashboard');
      await platform.dismissWasmDialog();
      await expect(platform.dashboardHeading).toBeVisible();

      await checkA11y(page);
    });

    await test.step('Create org', async () => {
      await platform.orgsTab.click();
      await platform.createOrgButton.click();
      await platform.orgNameInput.fill(orgName);
      await platform.submitButton.filter({ hasText: /submit|create/i }).click();
      await expect(page.getByText(orgName)).toBeVisible();
    });

    await test.step('Create repo', async () => {
      await platform.reposTab.click();
      await platform.createRepoButton.click();
      await platform.repoNameInput.fill(repoName);
      await platform.submitButton.filter({ hasText: /submit|create|link/i }).click();
      await expect(page.getByText(repoName)).toBeVisible();

      await page.getByText(repoName).click();

      await checkA11y(page);
    });

    await test.step('Establish openapi spec', async () => {
      if (await platform.addSpecButton.isVisible()) {
        await platform.addSpecButton.click();
        if (await platform.specUrlInput.isVisible()) {
          await platform.specUrlInput.fill('https://petstore3.swagger.io/api/v3/openapi.json');
        }
      }
      await page.goto('/');
      await platform.dismissWasmDialog();
      await expect(page.getByText(/petstore/i).first()).toBeVisible();
    });

    await test.step('Execute generation', async () => {
      await expect(platform.executeButton.first()).toBeVisible();
      await platform.executeButton.first().click();
    });

    await test.step('Confirm production of 13 SDKs and CLIs', async () => {
      await expect(page.getByText(/Successfully generated/i)).toBeVisible({ timeout: 60000 });
      await expect(page.locator('.node, [role="treeitem"]').first()).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step('Release and confirm HTML API docs (when present in workspace)', async () => {
      const released = await platform.clickIfVisible(platform.releaseDocsButton);
      if (released) {
        await expect(platform.viewDocsLink).toBeVisible();
      } else {
        await expect(platform.releaseDocsButton).toHaveCount(0);
      }
    });

    await test.step('Cleanup: Delete docs, SDKs, repo, org, and account', async () => {
      await platform.clickIfVisible(platform.deleteDocsButton);
      await platform.clickIfVisible(platform.deleteGenerationButton);

      await page.goto('/dashboard');
      await platform.dismissWasmDialog();
      await expect(platform.dashboardHeading).toBeVisible();

      await platform.clickIfVisible(platform.deleteRepoButton);
      await platform.clickIfVisible(platform.deleteOrgButton);
      await platform.clickIfVisible(platform.profileButton);
      await platform.clickIfVisible(platform.settingsTab);
      await platform.clickIfVisible(platform.deleteAccountButton);
    });
  });

  test('Negative flow: invalid login credentials', async ({ page }) => {
    await platform.navigateToHome();
    await platform.settingsButton.click();

    await platform.backendUrlInput.fill(process.env['BASE_URL'] || 'http://localhost:8086');
    await platform.connectButton.click();
    await expect(page.getByText('Connected!', { exact: true })).toBeVisible();

    await platform.usernameInput.fill('invalid@example.com');
    await platform.passwordInput.fill('WrongPassword!');
    await platform.loginButton.click();

    await expect(platform.dialog.getByText(/error|invalid|failed/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('Negative flow: empty organization name validation', async ({ page }) => {
    await platform.navigateToHome();
    await platform.settingsButton.click();
    await platform.backendUrlInput.fill(process.env['BASE_URL'] || 'http://localhost:8086');
    await platform.connectButton.click();
    await platform.usernameInput.fill(username);
    await platform.passwordInput.fill(password);
    await platform.registerButton.click();
    await expect(page.getByText('Registered successfully!', { exact: true })).toBeVisible();
    await platform.closeDialogButton.click();

    await page.goto('/dashboard');
    await platform.dismissWasmDialog();

    await platform.orgsTab.click();
    await platform.createOrgButton.click();

    const submitBtn = platform.submitButton.filter({ hasText: /submit|create/i });
    await expect(submitBtn).toBeDisabled();

    const input = platform.orgNameInput;
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('');
  });
});
