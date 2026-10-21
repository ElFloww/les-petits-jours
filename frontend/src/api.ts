export interface Account {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  isAdmin: boolean;
}
export interface ManagedUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  isActive: boolean;
  isAdmin: boolean;
}
export interface Day {
  day: number;
  state: 'locked' | 'available' | 'opened';
  unlocksAt: string;
}
export interface Calendar {
  year: number;
  today: string;
  decoration: string;
  days: Day[];
  canPreview?: boolean;
}
export interface Entry {
  day: number;
  kind: 'blague' | 'anecdote' | 'activite' | 'surprise';
  title: string;
  text: string;
  sticker: string;
  firstOpenedAt?: string;
  blocks?: ContentBlock[] | null;
}
export type ContentBlock =
  | { type: 'text' | 'quote'; text: string; caption?: string | null; mediaId?: null }
  | { type: 'image' | 'video' | 'audio'; mediaId: string; caption: string; text?: null };
export interface GiftDraft {
  day: number;
  kind: Entry['kind'];
  title: string;
  text: string;
  sticker: string;
  reviewed: boolean;
  blocks: ContentBlock[];
}
export interface PreviewEntry extends Entry {
  isPublished: boolean;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

let csrf: string | undefined;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', cache: 'no-store' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Connexion impossible. Vérifiez votre réseau et réessayez.');
  }
  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => null);
    const title = typeof problem === 'object' && problem !== null && 'title' in problem && typeof problem.title === 'string'
      ? problem.title : 'Le serveur ne répond pas correctement. Réessayez.';
    if (response.status === 400 || response.status === 401) csrf = undefined;
    throw new ApiError(response.status, response.status === 429
      ? 'Trop de tentatives. Patientez quelques minutes avant de réessayer.' : title);
  }
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw new ApiError(502, 'La réponse du serveur est illisible. Réessayez.');
  }
}

async function post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!csrf) csrf = (await request<{ token: string }>('/auth/csrf', { signal })).token;
  return request<T>(path, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function mutate<T>(path: string, method: string, body: unknown): Promise<T> {
  if (!csrf) csrf = (await request<{ token: string }>('/auth/csrf')).token;
  return request<T>(path, {
    method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(body),
  });
}

async function mutateWithoutBody<T>(path: string, method: string): Promise<T> {
  if (!csrf) csrf = (await request<{ token: string }>('/auth/csrf')).token;
  return request<T>(path, { method, headers: { 'X-CSRF-Token': csrf } });
}

async function saveGiftAt(path: string, content: GiftDraft, publish: boolean): Promise<PreviewEntry> {
  if (!csrf) csrf = (await request<{ token: string }>('/auth/csrf')).token;
  const result = await request<{ content: Entry; isPublished: boolean }>(path, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ content, publish }),
  });
  return { ...result.content, isPublished: result.isPublished };
}

async function uploadMediaAt(path: string, file: File): Promise<{ mediaId: string; type: 'image' | 'video' | 'audio' }> {
  if (!csrf) csrf = (await request<{ token: string }>('/auth/csrf')).token;
  return request(path, {
    method: 'POST', headers: { 'Content-Type': file.type, 'X-CSRF-Token': csrf }, body: file,
  });
}

export const api = {
  me: () => request<Account>('/auth/me'),
  calendar: () => request<Calendar>('/calendar/'),
  async login(email: string, password: string) {
    csrf = undefined;
    const account = await post<Account>('/auth/login', { email, password });
    csrf = undefined;
    return account;
  },
  forgotPassword: (email: string) => post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => post<void>('/auth/reset-password', { token, password }),
  managedUsers: () => request<ManagedUser[]>('/admin/users/'),
  createManagedUser: (user: { email: string; displayName: string; password: string }) =>
    mutate<ManagedUser>('/admin/users/', 'POST', user),
  updateManagedUser: (user: Pick<ManagedUser, 'id' | 'email' | 'displayName'>) =>
    mutate<ManagedUser>(`/admin/users/${user.id}`, 'PUT', { email: user.email, displayName: user.displayName }),
  setManagedUserPassword: (id: string, password: string) =>
    mutate<void>(`/admin/users/${id}/password`, 'PUT', { password }),
  setManagedUserActive: (id: string, isActive: boolean) =>
    mutate<void>(`/admin/users/${id}/active`, 'PUT', { isActive }),
  deleteManagedUser: (id: string) => mutateWithoutBody<void>(`/admin/users/${id}`, 'DELETE'),
  async logout() {
    await post<void>('/auth/logout');
    csrf = undefined;
  },
  open: (day: number, signal?: AbortSignal) => post<Entry>(`/calendar/${day}/open`, undefined, signal),
  async preview(day: number, signal?: AbortSignal): Promise<PreviewEntry> {
    const result = await request<{ content: Entry; isPublished: boolean }>(`/preview/calendar/${day}`, { signal });
    return { ...result.content, isPublished: result.isPublished };
  },
  async adminGift(userId: string, day: number, signal?: AbortSignal): Promise<PreviewEntry> {
    const result = await request<{ content: Entry; isPublished: boolean }>(`/admin/gifts/${userId}/${day}`, { signal });
    return { ...result.content, isPublished: result.isPublished };
  },
  saveGift: (content: GiftDraft, publish: boolean) =>
    saveGiftAt(`/preview/calendar/${content.day}`, content, publish),
  saveAdminGift: (userId: string, content: GiftDraft, publish: boolean) =>
    saveGiftAt(`/admin/gifts/${userId}/${content.day}`, content, publish),
  uploadMedia: (day: number, file: File) =>
    uploadMediaAt(`/preview/calendar/${day}/media`, file),
  uploadAdminGiftMedia: (userId: string, day: number, file: File) =>
    uploadMediaAt(`/admin/gifts/${userId}/${day}/media`, file),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue. Réessayez.';
}
