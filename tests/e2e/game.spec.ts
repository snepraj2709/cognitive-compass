import { test, expect } from '@playwright/test';

test('complete_game_as_guest', async ({ page }) => {
  const firstProfile = {
    id: 'profile-1',
    slug: 'profile-1',
    name: 'Profile One',
    avatar: 'A',
    difficulty: 'EASY' as const,
    scenario: 'First scenario: evaluate a rushed team decision.',
    context: 'Workplace',
    clues: ['deadline pressure'],
    sortOrder: 1,
  };

  const secondProfile = {
    id: 'profile-2',
    slug: 'profile-2',
    name: 'Profile Two',
    avatar: 'B',
    difficulty: 'EASY' as const,
    scenario: 'Second scenario: evaluate a reflective planning process.',
    context: 'Planning',
    clues: ['iterative review'],
    sortOrder: 2,
  };

  await page.route('**/api/game/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 'session-e2e-1',
        guestToken: 'guest-e2e-1',
        currentProfile: firstProfile,
        totalProfiles: 8,
        profileIndex: 0,
        completedScores: [],
      }),
    });
  });

  await page.route('**/api/game/session/session-e2e-1/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'event:score',
        'data:{"total":3,"breakdown":{"DR":true,"SE":true,"SR":false,"CV":true}}',
        '',
        'event:feedback_chunk',
        'data:{"chunk":"You mapped most cues correctly and identified strong decision signals."}',
        '',
        'event:next_profile',
        `data:${JSON.stringify({ profileIndex: 1, profile: secondProfile })}`,
        '',
        'event:done',
        'data:{"ok":true}',
        '',
      ].join('\n'),
    });
  });

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Begin Profiling' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin Profiling' }).click();

  await expect(page.getByText(firstProfile.scenario)).toBeVisible();

  await page
    .getByRole('button', { name: /Reasoning Depth: Surface/i })
    .click();
  await page
    .getByRole('button', { name: /Exploration Width: Single/i })
    .click();
  await page
    .getByRole('button', { name: /Reflection Frequency: Rare/i })
    .click();
  await page
    .getByRole('button', { name: /Convergence Style: Deadline/i })
    .click();

  await page.getByRole('button', { name: /Submit profile analysis/i }).click();

  await expect(page.getByText('3/4')).toBeVisible();
  await expect(
    page.getByText(
      'You mapped most cues correctly and identified strong decision signals.'
    )
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Next Profile/i }).click();

  const scenario = page.locator('blockquote');
  await expect(scenario).toContainText(secondProfile.scenario);
  await expect(scenario).not.toContainText(firstProfile.scenario);
});
