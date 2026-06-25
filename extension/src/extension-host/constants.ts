/*
 * 확장 호스트 전체에서 사용하는 상수 모음.
 *
 * 하드코딩된 문자열이 여기 한 곳에 모여 있어야 변경 시 수정 지점이 하나다.
 * VS Code 설정 키는 package.json contributes.configuration 과 반드시 일치해야 한다.
 */

/* ────── VS Code 설정 키 ────── */

/** klee-code.backendUrl 설정 키 — package.json 과 동기화 필요 */
export const CONFIG_BACKEND_URL = 'klee-code.backendUrl';

/* ────── 백엔드 API 경로 ────── */

/** POST /chat 엔드포인트 경로 */
export const API_CHAT = '/chat';

/** POST /chat/stream SSE 엔드포인트 경로 */
export const API_CHAT_STREAM = '/chat/stream';

export const API_CONVERSATIONS = '/conversations';
export const API_CHAT_HISTORY = '/audit/chat-history';
export const API_AUTH_REGISTER = '/auth/register';
export const API_AUTH_LOGIN = '/auth/login';
export const API_AUTH_REFRESH = '/auth/refresh';
export const API_AUTH_LOGOUT = '/auth/logout';
export const API_AUTH_ME = '/auth/me';
export const API_MODEL_CONFIG = '/me/model-config';
export const SECRET_REFRESH_TOKEN_KEY = 'klee-code.refreshToken';

/** GET /chat/status 엔드포인트 경로 */
export const API_CHAT_STATUS = '/chat/status';

/* ────── UI 텍스트 ────── */

/** VS Code 출력 채널 이름 */
export const OUTPUT_CHANNEL_NAME = 'Klee Code';

/** 새 대화 시작 구분선 */
export const NEW_CONVERSATION_SEPARATOR = '\n─── New conversation ───';
