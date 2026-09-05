import Cookies from 'js-cookie';

// secure:true casse le stockage du cookie en HTTP (dev local http://localhost).
// On n'active Secure que si la page est effectivement servie en HTTPS.
const isHttps = () => typeof window !== 'undefined' && window.location.protocol === 'https:';

const baseOptions = () => ({ secure: isHttps(), sameSite: 'lax' as const });

export function setAccessToken(token: string) {
  Cookies.set('access_token', token, { ...baseOptions(), expires: 1 / 96 }); // 15min
}

export function setRefreshToken(token: string) {
  Cookies.set('refresh_token', token, { ...baseOptions(), expires: 7 });
}

export function getAccessToken() {
  return Cookies.get('access_token');
}

export function getRefreshToken() {
  return Cookies.get('refresh_token');
}

export function clearAuthCookies() {
  Cookies.remove('access_token');
  Cookies.remove('refresh_token');
}
