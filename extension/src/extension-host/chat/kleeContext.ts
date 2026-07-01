import * as vscode from 'vscode';
import type { KleeContext, KleePromptFile } from './types';

const MAX_PROMPT_FILE_BYTES = 64 * 1024;

interface RawKleeFile {
    directory: 'rules' | 'skills' | 'hooks' | string;
    name: string;
    path: string;
    content: string;
}

export function buildKleeContextFromFiles(files: RawKleeFile[], skillName?: string): KleeContext | undefined {
    const normalizedSkillName = normalizeName(skillName);
    const context: KleeContext = {
        rules: files
            .filter((file) => file.directory === 'rules')
            .sort(compareKleeFiles)
            .map(toPromptFile),
        skills: files
            .filter((file) => file.directory === 'skills')
            .filter((file) => normalizedSkillName !== undefined && normalizeName(file.name) === normalizedSkillName)
            .sort(compareKleeFiles)
            .map(toPromptFile),
        hooks: files
            .filter((file) => file.directory === 'hooks')
            .sort(compareKleeFiles)
            .map(toPromptFile),
    };

    if (context.rules.length === 0 && context.skills.length === 0 && context.hooks.length === 0) {
        return undefined;
    }

    return context;
}

export async function readWorkspaceKleeContext(skillName?: string): Promise<KleeContext | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
        return undefined;
    }

    const files: RawKleeFile[] = [];
    for (const directory of ['rules', 'skills', 'hooks'] as const) {
        files.push(...await readKleeDirectory(workspaceFolder.uri, directory));
    }

    return buildKleeContextFromFiles(files, skillName);
}

async function readKleeDirectory(workspaceUri: vscode.Uri, directory: 'rules' | 'skills' | 'hooks'): Promise<RawKleeFile[]> {
    const directoryUri = vscode.Uri.joinPath(workspaceUri, '.klee', directory);

    try {
        const entries = await vscode.workspace.fs.readDirectory(directoryUri);
        const markdownFiles = entries
            .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
            .sort(([left], [right]) => left.localeCompare(right));

        const files: RawKleeFile[] = [];
        for (const [fileName] of markdownFiles) {
            const fileUri = vscode.Uri.joinPath(directoryUri, fileName);
            const content = await readSmallTextFile(fileUri);
            if (content !== undefined) {
                files.push({
                    directory,
                    name: fileName.slice(0, -'.md'.length),
                    path: `.klee/${directory}/${fileName}`,
                    content,
                });
            }
        }
        return files;
    } catch {
        return [];
    }
}

async function readSmallTextFile(uri: vscode.Uri): Promise<string | undefined> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (bytes.byteLength > MAX_PROMPT_FILE_BYTES) {
            return undefined;
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
        return undefined;
    }
}

function toPromptFile(file: RawKleeFile): KleePromptFile {
    return {
        name: file.name,
        path: file.path,
        content: file.content,
    };
}

function compareKleeFiles(left: RawKleeFile, right: RawKleeFile): number {
    return left.path.localeCompare(right.path);
}

function normalizeName(name: string | undefined): string | undefined {
    if (!name) {
        return undefined;
    }
    return name.trim().toLowerCase();
}
