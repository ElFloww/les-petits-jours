import { expect, test } from '@playwright/test';
import type { GiftDraft } from '../src/api';

// HTTP behavior is exercised against real SQL in Advent.Tests. These UI fixtures
// deliberately cover December regardless of the machine's current date.
test.beforeEach(async ({ page }) => {
  let authenticated = false;
  const opened = new Set<number>();
  const drafts = new Map<number, { content: GiftDraft; isPublished: boolean }>();
  const media = new Map<string, { body: Buffer; contentType: string }>();
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/csrf') return route.fulfill({ json: { token: 'test-csrf' } });
    if (path === '/api/auth/login') { authenticated = true; return route.fulfill({ json: { id: '1', username: 'louisa', displayName: 'Louisa' } }); }
    if (path === '/api/auth/logout') { authenticated = false; return route.fulfill({ status: 204 }); }
    if (!authenticated) return route.fulfill({ status: 401, json: { title: 'Session expirée' } });
    if (path === '/api/auth/me') return route.fulfill({ json: { id: '1', username: 'louisa', displayName: 'Louisa' } });
    if (path === '/api/calendar/') return route.fulfill({ json: {
      year: 2026, today: '2026-12-10', decoration: 'Les petits bonheurs font les grands décembres.', canPreview: true,
      days: Array.from({ length: 24 }, (_, index) => ({
        day: index + 1, state: index >= 10 ? 'locked' : opened.has(index + 1) ? 'opened' : 'available',
        unlocksAt: `2026-12-${String(index + 1).padStart(2, '0')}T00:00:00+01:00`,
      })),
    } });
    const preview = path.match(/^\/api\/preview\/calendar\/(\d+)$/);
    if (preview && route.request().method() === 'PUT') {
      const { content, publish } = route.request().postDataJSON() as { content: GiftDraft; publish: boolean };
      const saved = { content, isPublished: publish };
      drafts.set(Number(preview[1]), saved);
      return route.fulfill({ json: saved });
    }
    const upload = path.match(/^\/api\/preview\/calendar\/(\d+)\/media$/);
    if (upload) {
      const mediaId = String(media.size + 1).padStart(32, '0');
      const contentType = route.request().headers()['content-type'];
      media.set(mediaId, { body: route.request().postDataBuffer()!, contentType });
      return route.fulfill({ status: 201, json: { mediaId, type: contentType.split('/')[0] } });
    }
    const download = path.match(/^\/api\/preview\/calendar\/\d+\/media\/(\w+)$/);
    if (download) {
      const file = media.get(download[1]);
      return file ? route.fulfill(file) : route.fulfill({ status: 404 });
    }
    if (preview) return route.fulfill({ json: drafts.get(Number(preview[1])) ?? {
      content: {
        day: Number(preview[1]), kind: 'surprise', title: `Brouillon du ${preview[1]}`,
        text: 'Ce contenu de travail ne doit pas enregistrer une ouverture.', sticker: 'rire',
      }, isPublished: false,
    } });
    const match = path.match(/^\/api\/calendar\/(\d+)\/open$/);
    if (match && Number(match[1]) <= 10) {
      const day = Number(match[1]);
      opened.add(day);
      return route.fulfill({ json: {
        day, kind: 'surprise', title: 'Un petit bonheur pour Louisa',
        text: 'Une attention rien que pour toi. Les petits cadeaux restent accessibles.',
        sticker: 'sourire', firstOpenedAt: '2026-12-10T10:00:00Z',
      } });
    }
    return route.fulfill({ status: 403, json: { title: 'Case verrouillée' } });
  });
});

  test('local composer saves long text, a quotation and private media, then publishes explicitly', async ({ page }) => {
    const openingRequests: string[] = [];
    page.on('request', request => { if (request.url().endsWith('/open')) openingRequests.push(request.url()); });
    await page.goto('/');
    await page.getByLabel('Votre identifiant').fill('louisa');
    await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
    await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
    await page.getByRole('button', { name: 'Prévisualiser les 24 cases' }).click();
    await page.getByRole('button', { name: '24 décembre — Prévisualiser' }).click();
    await page.getByRole('button', { name: 'Composer ce cadeau' }).click();
    await page.getByLabel('Titre du cadeau').fill('Les couleurs de notre Noël');
    const text = 'Une petite attention, rien que pour toi.\n\n'.repeat(150);
    await page.getByLabel('Ton message').fill(text);
    await page.getByRole('button', { name: '+ Citation', exact: true }).click();
    await page.getByLabel('La citation', { exact: true }).fill('Les petits moments font les beaux souvenirs.');
    await page.getByLabel('Signature ou auteur').fill('Pour toi');
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'lumiere.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP7sAAAAASUVORK5CYII=', 'base64'),
    });
    await expect(page.getByText('Fichier importé et privé')).toBeVisible();
    await page.getByLabel('Description / légende').fill('Une lumière de Noël');
    await page.getByRole('button', { name: 'Monter le bloc 2' }).click();
    await expect(page.locator('.editor-block').first()).toHaveAttribute('aria-label', 'Bloc 1 — Image');
    await expect(page.getByRole('button', { name: 'Publier ce cadeau' })).toBeDisabled();
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect(page.getByRole('status')).toContainText('Brouillon enregistré');
    await page.getByRole('button', { name: 'Voir le rendu' }).click();
    await expect(page.getByRole('heading', { name: 'Les couleurs de notre Noël' })).toBeVisible();
    await expect(page.locator('blockquote')).toContainText('Les petits moments');
    await page.getByAltText('Une lumière de Noël').scrollIntoViewIfNeeded();
    await expect(page.getByAltText('Une lumière de Noël')).toBeVisible();
    await expect.poll(() => page.getByAltText('Une lumière de Noël').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.surprise-text')).toHaveText(text.trim());
    expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Revenir au cadeau' }).click();
    await page.getByRole('button', { name: 'Fermer la surprise' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Prévisualiser les 24 cases' }).click();
    await page.getByRole('button', { name: '24 décembre — Prévisualiser' }).click();
    await expect(page.locator('blockquote')).toContainText('Les petits moments');
    await page.getByRole('button', { name: 'Composer ce cadeau' }).click();
    await page.getByRole('checkbox', { name: /J’ai relu/ }).check();
    await page.getByRole('button', { name: 'Publier ce cadeau' }).click();
    await expect(page.getByRole('status')).toContainText('Cadeau publié');
    expect(openingRequests).toHaveLength(0);
  });

  test('composer guards unsaved changes, reports upload errors and renders native media controls', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Votre identifiant').fill('louisa');
    await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
    await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
    await page.getByRole('button', { name: 'Prévisualiser les 24 cases' }).click();
    await page.getByRole('button', { name: '1 décembre — Prévisualiser', exact: true }).click();
    await page.getByRole('button', { name: 'Composer ce cadeau' }).click();
    await page.getByRole('button', { name: '+ Vidéo', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'incorrect.txt', mimeType: 'text/plain', buffer: Buffer.from('incorrect') });
    await expect(page.getByRole('alert')).toContainText('compatible');
    const videoBytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d')!;
      const stream = canvas.captureStream(10);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = event => chunks.push(event.data);
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.onerror = () => reject(new Error('Unable to create test video'));
      });
      recorder.start();
      context.fillStyle = '#194f3c';
      context.fillRect(0, 0, 64, 64);
      await new Promise(resolve => setTimeout(resolve, 350));
      recorder.stop();
      const blob = await finished;
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page.locator('input[type=file]').setInputFiles({ name: 'noel.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) });
    await expect(page.getByText('Fichier importé et privé')).toBeVisible();
    await page.getByLabel('Description / légende').fill('Un film de Noël');
    await page.getByRole('button', { name: '+ Audio', exact: true }).click();
    await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'message.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3') });
    await expect(page.getByText('Fichier importé et privé')).toHaveCount(2);
    await page.getByLabel('Description / légende').nth(1).fill('Un petit message');
    await page.getByRole('button', { name: 'Voir le rendu' }).click();
    await expect(page.locator('video')).toHaveAttribute('controls', '');
    await expect(page.locator('video')).toHaveAttribute('preload', 'metadata');
    await expect(page.locator('video')).not.toHaveAttribute('autoplay');
    await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(64);
    expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    await expect(page.locator('audio')).toHaveAttribute('controls', '');
    await expect(page.getByRole('alert').first()).toContainText('Ce média ne peut pas être lu');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Fermer la surprise' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Composer', exact: true }).click();
    await expect(page.getByLabel('Description / légende').first()).toHaveValue('Un film de Noël');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Fermer la surprise' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

test('composer distinguishes a missing gift from a read failure and preserves failed saves', async ({ page }) => {
  let missing = false;
  let saves = 0;
  await page.route('**/api/preview/calendar/24', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: missing ? 404 : 503, json: { title: missing ? 'Case encore vide' : 'Lecture indisponible' } });
    }
    saves++;
    if (saves === 1) return route.fulfill({ status: 500, json: { title: 'Enregistrement impossible' } });
    return route.fulfill({ json: { content: route.request().postDataJSON().content, isPublished: false } });
  });
  await page.goto('/');
  await page.getByLabel('Votre identifiant').fill('louisa');
  await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
  await page.getByRole('button', { name: 'Prévisualiser les 24 cases' }).click();
  await page.getByRole('button', { name: '24 décembre — Prévisualiser' }).click();
  await expect(page.getByRole('alert')).toContainText('Lecture indisponible');
  await expect(page.getByRole('button', { name: 'Composer ce cadeau' })).toBeDisabled();
  missing = true;
  await page.getByRole('button', { name: /Réessayer/ }).click();
  await expect(page.getByRole('alert')).toContainText('Case encore vide');
  await page.getByRole('button', { name: 'Composer ce cadeau' }).click();
  await page.getByLabel('Titre du cadeau').fill('Un cadeau tout neuf');
  await page.getByLabel('Ton message').fill('Un message à conserver.');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByRole('alert')).toContainText('Enregistrement impossible');
  await expect(page.getByLabel('Ton message')).toHaveValue('Un message à conserver.');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByRole('status')).toContainText('Brouillon enregistré');
});

test('login, keyboard dialog, persistent rereading and logout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Les petits jours/);
  await page.getByLabel('Votre identifiant').fill('louisa');
  await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
  await expect(page.getByRole('button', { name: /décembre —/ })).toHaveCount(24);
  const first = page.getByRole('button', { name: '1 décembre — À découvrir', exact: true });
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Un petit bonheur pour Louisa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fermer la surprise' })).toBeFocused();
  const image = page.locator('.sticker');
  await expect(image).toBeVisible();
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(300);
  await page.keyboard.press('Escape');
  const reread = page.getByRole('button', { name: '1 décembre — Déjà ouvert', exact: true });
  await expect(reread).toBeFocused();
  await page.reload();
  await expect(reread).toBeVisible();
  await expect(page.getByRole('button', { name: '24 décembre — À patienter' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Se déconnecter/ }).click();
  await expect(page.getByLabel('Votre identifiant')).toBeVisible();
});

test('last available day, reduced motion and mobile layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Votre identifiant').fill('louisa');
  await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
  await page.getByRole('button', { name: '10 décembre — À découvrir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Suivant →' })).toBeDisabled();
  await page.getByRole('button', { name: 'Précédent' }).click();
  await expect(page.getByRole('dialog')).toContainText('09 DÉCEMBRE 2026');
  await page.getByRole('button', { name: 'Fermer la surprise' }).click();
  const gifts = page.locator('.gift');
  for (const gift of await gifts.all()) {
    const box = await gift.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('atelier previews all drafts and returns to an unchanged calendar', async ({ page }) => {
  const openingRequests: string[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/open')) openingRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByLabel('Votre identifiant').fill('louisa');
  await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
  await page.getByRole('button', { name: 'Prévisualiser les 24 cases' }).click();
  await expect(page.getByRole('button', { name: /décembre — Prévisualiser/ })).toHaveCount(24);
  const gift = page.getByRole('button', { name: '24 décembre — Prévisualiser' });
  await gift.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Brouillon du 24' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Brouillon non publié');
  await expect(page.getByRole('button', { name: 'Suivant →' })).toBeDisabled();
  await page.getByRole('button', { name: 'Précédent' }).click();
  await expect(page.getByRole('heading', { name: 'Brouillon du 23' })).toBeVisible();
  await page.getByRole('button', { name: 'Actualiser le contenu' }).click();
  await expect(page.getByRole('heading', { name: 'Brouillon du 23' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(gift).toBeFocused();
  await page.getByRole('button', { name: 'Revenir au calendrier réel' }).click();
  await expect(page.getByRole('button', { name: '24 décembre — À patienter' })).toBeDisabled();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(openingRequests).toHaveLength(0);
});

test('gifts follow one continuous garland without overlap at every layout breakpoint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Votre identifiant').fill('louisa');
  await page.getByLabel('Votre mot de passe', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Découvrir mon calendrier' }).click();
  await expect(page.locator('.gift')).toHaveCount(24);

  for (const width of [320, 390, 760, 900, 901, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const layout = await page.locator('.gift-trail').evaluate(trail => {
      const wire = trail.querySelector<SVGPathElement>(
        getComputedStyle(trail.querySelector('.garland-mobile')!).display === 'none'
          ? '.garland-desktop .garland-cord' : '.garland-mobile .garland-cord',
      )!;
      const matrix = wire.getScreenCTM()!;
      const vertices = wire.getAttribute('d')!.split(/[MC]/).filter(segment => segment.trim()).map(segment => {
        const coordinates = segment.trim().split(/[\s,]+/).map(Number);
        return new DOMPoint(coordinates[coordinates.length - 2], coordinates[coordinates.length - 1]).matrixTransform(matrix);
      });
      const attachments = Array.from(trail.querySelectorAll('.gift-tie'), (tie, index) => {
        const box = tie.getBoundingClientRect();
        return Math.hypot(vertices[index].x - (box.x + box.width / 2), vertices[index].y - box.y);
      });
      const boxes = Array.from(trail.querySelectorAll('.gift, .gift-caption'), element => {
        const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
        return { x, y, width, height, right, bottom };
      });
      const overlaps = boxes.flatMap((box, index) => boxes.slice(index + 1)
        .filter(other => box.x < other.right && box.right > other.x && box.y < other.bottom && box.bottom > other.y));
      return {
        attachments, overlaps, vertices: vertices.length, height: trail.getBoundingClientRect().height,
        starts: wire.getAttribute('d')!.match(/M/g)?.length,
        inBounds: boxes.every(box => box.x >= 0 && box.right <= window.innerWidth),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(layout.overflow, `horizontal overflow at ${width}px`).toBe(false);
    expect(layout.height).toBeGreaterThan(1800);
    expect(layout.starts).toBe(1);
    expect(layout.vertices).toBe(24);
    expect(Math.max(...layout.attachments), `detached gifts at ${width}px`).toBeLessThan(1);
    expect(layout.inBounds, `clipped gifts at ${width}px`).toBe(true);
    expect(layout.overlaps, `overlapping gifts or captions at ${width}px`).toHaveLength(0);
  }
});
