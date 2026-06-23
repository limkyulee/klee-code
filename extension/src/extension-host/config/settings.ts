/*
 * VS Code 설정 접근 레이어.
 *
 * vscode.workspace.getConfiguration 호출을 한 곳에 모아
 * 다른 모듈이 VS Code API 를 직접 참조하지 않도록 한다.
 * package.json 의 contributes.configuration.default 가 실제 기본값이므로
 * 코드에 기본값을 중복으로 정의하지 않는다.
 */

import * as vscode from 'vscode';
import { CONFIG_BACKEND_URL } from '../constants';

/**
 * 사용자가 설정한 백엔드 서버 URL 을 반환한다.
 *
 * package.json 에 기본값(http://localhost:8080)이 선언되어 있으므로
 * 사용자가 별도로 설정하지 않아도 항상 값이 반환된다.
 */
export function getBackendUrl(): string {
    /* package.json default 덕분에 !-assertion 이 안전하다 */
    return vscode.workspace.getConfiguration().get<string>(CONFIG_BACKEND_URL)!;
}
