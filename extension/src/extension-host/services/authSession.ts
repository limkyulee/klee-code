import * as vscode from 'vscode';
import type { AuthResponse, UserProfile } from '../chat/types';
import { SECRET_REFRESH_TOKEN_KEY } from '../constants';
import { login, logout, me, refresh, register } from './chatApiClient';

export class AuthSession {
    private accessToken: string | undefined;
    private profile: UserProfile | undefined;

    constructor(private readonly secrets: vscode.SecretStorage) {}

    get currentUser(): UserProfile | undefined {
        return this.profile;
    }

    async restore(): Promise<UserProfile | undefined> {
        const refreshToken = await this.secrets.get(SECRET_REFRESH_TOKEN_KEY);
        if (!refreshToken) {
            return undefined;
        }

        try {
            await this.applyAuthResponse(await refresh(refreshToken));
            return this.profile;
        } catch {
            await this.clear();
            return undefined;
        }
    }

    async login(userId: string, password: string): Promise<UserProfile> {
        await this.applyAuthResponse(await login(userId, password));
        return this.profile!;
    }

    async register(userId: string, password: string): Promise<UserProfile> {
        await this.applyAuthResponse(await register(userId, password));
        return this.profile!;
    }

    async signOut(): Promise<void> {
        const refreshToken = await this.secrets.get(SECRET_REFRESH_TOKEN_KEY);
        try {
            if (refreshToken) {
                await logout(refreshToken, { accessToken: this.accessToken });
            }
        } catch {
            // Local sign-out must still complete when the server session is already expired.
        } finally {
            await this.clear();
        }
    }

    async getAccessToken(): Promise<string | undefined> {
        if (this.accessToken) {
            return this.accessToken;
        }

        await this.restore();
        return this.accessToken;
    }

    async refreshAccessToken(): Promise<string | undefined> {
        const refreshToken = await this.secrets.get(SECRET_REFRESH_TOKEN_KEY);
        if (!refreshToken) {
            return undefined;
        }
        await this.applyAuthResponse(await refresh(refreshToken));
        return this.accessToken;
    }

    async verifyProfile(): Promise<UserProfile | undefined> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            return undefined;
        }

        this.profile = await me({ accessToken });
        return this.profile;
    }

    private async applyAuthResponse(response: AuthResponse): Promise<void> {
        this.accessToken = response.accessToken;
        this.profile = response.user;
        await this.secrets.store(SECRET_REFRESH_TOKEN_KEY, response.refreshToken);
    }

    private async clear(): Promise<void> {
        this.accessToken = undefined;
        this.profile = undefined;
        await this.secrets.delete(SECRET_REFRESH_TOKEN_KEY);
    }
}
