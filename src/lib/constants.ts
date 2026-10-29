export const SHARED_APP_URL = 'https://ais-pre-fpw2tpblkoiwuedaoanbgs-742916804260.asia-southeast1.run.app';
export const DEV_APP_URL = 'https://ais-dev-fpw2tpblkoiwuedaoanbgs-742916804260.asia-southeast1.run.app';
export const OWNER_EMAIL = 'zainchamp5@gmail.com';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * Returns the public statement link (?s=<token>)
 */
export function getStatementShareLink(token: string): string {
  return `${SHARED_APP_URL}/?s=${encodeURIComponent(token)}`;
}

/**
 * Returns the canonical invite deep link for a user
 */
export function getInviteDeepLink(usernameOrUid: string, inviterUid?: string): string {
  const params = new URLSearchParams();
  params.set('invite', usernameOrUid);
  if (inviterUid) params.set('from', inviterUid);
  return `${SHARED_APP_URL}/?${params.toString()}`;
}

/**
 * Returns the public preview URL for sharing
 */
export function getPublicPreviewUrl(): string {
  return SHARED_APP_URL;
}
