import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('style picker exposes every supported preset', () => {
  for (const style of ['single', 'tiled', 'rows', 'bands', 'dense']) assert.match(html, new RegExp(`data-style="${style}"`));
});
test('watermark text supports multiple lines', () => assert.match(html, /<textarea[^>]+id="watermarkText"/));
test('repeat checkbox is removed in favor of styles', () => assert.doesNotMatch(html, /id="repeat"/));
test('contextual gap controls exist', () => { assert.match(html, /id="rowGap"/); assert.match(html, /id="patternGap"/); });
test('rotation and position controls are wrapped for contextual visibility', () => { assert.match(html, /id="rotationControls"/); assert.match(html, /id="positionControls"/); });
test('local privacy badge is removed from topbar', () => assert.doesNotMatch(html, /LOCAL ONLY/));
test('onboarding has first-visit storage and close actions', () => {
  assert.match(html, /id="onboarding"/);
  assert.match(app, /mw-images-onboarding-seen/);
  assert.match(app, /onboardingStart/);
  assert.match(app, /onboardingClose/);
  assert.match(html, /data-onboarding-dot="0"/);
  assert.match(html, /data-onboarding-dot="3"/);
  assert.match(app, /showOnboardingStep/);
});
