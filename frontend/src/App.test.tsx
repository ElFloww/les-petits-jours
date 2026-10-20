import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api, ApiError, type Calendar } from './api';

vi.mock('./api', async importOriginal => {
  const original = await importOriginal<typeof import('./api')>();
  return { ...original, api: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), calendar: vi.fn(), open: vi.fn(), preview: vi.fn(), saveGift: vi.fn(), uploadMedia: vi.fn() } };
});

const account = { id: 'a1', username: 'louisa', displayName: 'Louisa' };
const calendar: Calendar = {
  year: 2026, today: '2026-12-10', decoration: 'Une phrase stable.',
  days: Array.from({ length: 24 }, (_, index) => ({
    day: index + 1, state: index < 10 ? 'available' : 'locked', unlocksAt: `2026-12-${String(index + 1).padStart(2, '0')}T00:00:00+01:00`,
  })),
};

beforeEach(() => {
  vi.mocked(api.me).mockReset();
  vi.mocked(api.login).mockReset();
  vi.mocked(api.logout).mockReset();
  vi.mocked(api.calendar).mockReset().mockResolvedValue(calendar);
  vi.mocked(api.open).mockReset();
  vi.mocked(api.preview).mockReset();
  vi.mocked(api.saveGift).mockReset();
  vi.mocked(api.uploadMedia).mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

describe('Private calendar', () => {
  it('renders rich gifts with accessible private media and no autoplay', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.open).mockResolvedValue({
      day: 1, kind: 'surprise', title: 'Un Noël en couleurs', text: 'Un long message.\n\nUn second paragraphe.', sticker: 'sourire',
      blocks: [
        { type: 'quote', text: 'Une petite attention.', caption: 'Pour toi' },
        { type: 'image', mediaId: 'abc', caption: 'Une lumière dorée' },
        { type: 'video', mediaId: 'def', caption: 'Notre vidéo' },
        { type: 'audio', mediaId: 'ghi', caption: 'Un message audio' },
      ],
    });
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: '1 décembre — À découvrir' }));
    await screen.findByRole('heading', { name: 'Un Noël en couleurs' });
    expect(screen.getByText('Une petite attention.').tagName).toBe('BLOCKQUOTE');
    expect(screen.getByAltText('Une lumière dorée')).toHaveAttribute('src', '/api/calendar/1/media/abc');
    const video = screen.getByLabelText('Notre vidéo');
    expect(video).toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
    fireEvent.error(video);
    expect(screen.getByRole('alert')).toHaveTextContent('Ce média ne peut pas être lu');
  });

  it('keeps failed edits and only publishes after explicit review', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.calendar).mockResolvedValue({ ...calendar, canPreview: true });
    vi.mocked(api.preview).mockResolvedValue({
      day: 24, kind: 'surprise', title: 'Brouillon', text: 'Un message', sticker: 'sourire', isPublished: false,
    });
    vi.mocked(api.saveGift).mockRejectedValueOnce(new ApiError(500, 'Enregistrement impossible.'));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Prévisualiser les 24 cases' }));
    await userEvent.click(screen.getByRole('button', { name: '24 décembre — Prévisualiser' }));
    await screen.findByRole('heading', { name: 'Brouillon' });
    await userEvent.click(await screen.findByRole('button', { name: 'Composer ce cadeau' }));
    fireEvent.change(screen.getByLabelText('Titre du cadeau'), { target: { value: 'Mon nouveau cadeau' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible');
    expect(screen.getByLabelText('Titre du cadeau')).toHaveValue('Mon nouveau cadeau');
    expect(screen.getByRole('button', { name: 'Publier ce cadeau' })).toBeDisabled();
    vi.mocked(api.saveGift).mockImplementation(async (content, publish) => ({ ...content, isPublished: publish }));
    await userEvent.click(screen.getByRole('checkbox', { name: /J’ai relu/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Publier ce cadeau' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cadeau publié');
    expect(api.saveGift).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Mon nouveau cadeau', reviewed: true }), true);
    expect(api.open).not.toHaveBeenCalled();
  });

  it('hides the atelier unless the API explicitly enables it', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    render(<App />);
    await screen.findByRole('button', { name: '24 décembre — À patienter' });
    expect(screen.queryByRole('button', { name: 'Prévisualiser les 24 cases' })).not.toBeInTheDocument();
  });

  it('previews and refreshes future drafts without opening them or changing real progress', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.calendar).mockResolvedValue({ ...calendar, canPreview: true });
    vi.mocked(api.preview).mockImplementation(async day => ({
      day, kind: 'surprise', title: `Brouillon ${day}`, text: 'Texte de travail', sticker: 'sourire', isPublished: false,
    }));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Prévisualiser les 24 cases' }));
    expect(screen.getAllByRole('button', { name: /décembre — Prévisualiser/ })).toHaveLength(24);
    await userEvent.click(screen.getByRole('button', { name: '24 décembre — Prévisualiser' }));
    await screen.findByRole('heading', { name: 'Brouillon 24' });
    expect(screen.getByRole('status')).toHaveTextContent('Brouillon non publié');
    expect(screen.getByRole('button', { name: 'Suivant →' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '← Précédent' }));
    await screen.findByRole('heading', { name: 'Brouillon 23' });
    vi.mocked(api.preview).mockResolvedValue({
      day: 23, kind: 'surprise', title: 'Texte corrigé', text: 'Correction importée', sticker: 'rire', isPublished: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Actualiser le contenu' }));
    await screen.findByRole('heading', { name: 'Texte corrigé' });
    expect(api.open).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar')).toHaveValue(0);
    await userEvent.click(screen.getByRole('button', { name: 'Fermer la surprise' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revenir au calendrier réel' }));
    expect(screen.getByRole('button', { name: '24 décembre — À patienter' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toHaveValue(0);
  });

  it('shows a missing draft and expires preview sessions without making an opening request', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.calendar).mockResolvedValue({ ...calendar, canPreview: true });
    vi.mocked(api.preview).mockRejectedValue(new ApiError(404, 'Importez les brouillons.'));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Prévisualiser les 24 cases' }));
    await userEvent.click(screen.getByRole('button', { name: '24 décembre — Prévisualiser' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Importez les brouillons');
    vi.mocked(api.preview).mockRejectedValue(new ApiError(401, 'Session expirée.'));
    await userEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByLabelText('Votre identifiant')).toBeInTheDocument();
    expect(api.open).not.toHaveBeenCalled();
  });

  it('logs in with labelled fields and shows 24 correct day states', async () => {
    vi.mocked(api.me).mockRejectedValue(new ApiError(401, 'Unauthorized'));
    vi.mocked(api.login).mockResolvedValue(account);
    render(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Votre identifiant'), 'louisa');
    await user.type(screen.getByLabelText('Votre mot de passe'), 'a-private-password');
    await user.click(screen.getByRole('button', { name: /Découvrir mon calendrier/ }));
    expect(api.login).toHaveBeenCalledWith('louisa', 'a-private-password');
    await screen.findByRole('button', { name: '1 décembre — À découvrir' });
    expect(screen.getAllByRole('button', { name: /décembre —/ })).toHaveLength(24);
    expect(screen.getByRole('button', { name: '11 décembre — À patienter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '10 décembre — À découvrir' })).toBeEnabled();
  });

  it('opens the server content, marks it opened and never navigates into future days', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.open).mockResolvedValue({
      day: 10, kind: 'surprise', title: 'Pour Louisa', text: 'Une attention stable.',
      sticker: 'sourire', firstOpenedAt: '2026-12-10T10:00:00Z',
    });
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: '10 décembre — À découvrir' }));
    expect(await screen.findByRole('heading', { name: 'Pour Louisa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suivant →' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '10 décembre — Déjà ouvert' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer la surprise' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows preparation errors without marking a failed opening', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.open).mockRejectedValue(new ApiError(404, 'Cette surprise est encore en préparation.'));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: '1 décembre — À découvrir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('en préparation');
    expect(screen.getByRole('button', { name: '1 décembre — À découvrir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeEnabled();
  });

  it('clears private content when a session expires', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.open).mockRejectedValue(new ApiError(401, 'Expired'));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: '1 décembre — À découvrir' }));
    expect(await screen.findByRole('status')).toHaveTextContent('session a expiré');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /1 décembre/ })).not.toBeInTheDocument();
  });

  it('shows a network error rather than pretending to be logged out', async () => {
    vi.mocked(api.me).mockRejectedValue(new ApiError(0, 'Connexion impossible.'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible');
    expect(screen.queryByLabelText('Votre identifiant')).not.toBeInTheDocument();
    vi.mocked(api.me).mockRejectedValue(new ApiError(401, 'Unauthorized'));
    await userEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByLabelText('Votre identifiant')).toBeInTheDocument();
  });

  it('does not pretend logout succeeded when the network fails', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    vi.mocked(api.logout).mockRejectedValue(new ApiError(0, 'Connexion impossible.'));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /Se déconnecter/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible');
    expect(screen.getByRole('button', { name: /Se déconnecter/ })).toBeInTheDocument();
  });

  it('refreshes server state on focus without using the browser date', async () => {
    vi.mocked(api.me).mockResolvedValue(account);
    render(<App />);
    await screen.findByRole('button', { name: '11 décembre — À patienter' });
    vi.mocked(api.calendar).mockResolvedValue({
      ...calendar, days: calendar.days.map(day => day.day === 11 ? { ...day, state: 'available' } : day),
    });
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByRole('button', { name: '11 décembre — À découvrir' })).toBeEnabled());
  });
});
