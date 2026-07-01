import * as path from 'path';
import * as vscode from 'vscode';
import type { ToolCallRequest } from './types';

const MAX_READ_BYTES = 200_000;
const MAX_SEARCH_RESULTS = 80;

export interface LocalToolArgumentSchema {
    type: 'string';
    required: boolean;
}

export interface LocalToolDefinition {
    name: string;
    description: string;
    arguments: Record<string, LocalToolArgumentSchema>;
    execute(toolCall: ToolCallRequest): Promise<string>;
}

const localToolDefinitions: LocalToolDefinition[] = [
    {
        name: 'read_file',
        description: 'Read a UTF-8 text file inside the active VS Code workspace.',
        arguments: {
            path: { type: 'string', required: true },
        },
        execute: (toolCall) => readFileTool(readStringArg(toolCall, 'path')),
    },
    {
        name: 'search_files',
        description: 'Search active workspace file paths by a short query.',
        arguments: {
            query: { type: 'string', required: true },
        },
        execute: (toolCall) => searchFilesTool(readStringArg(toolCall, 'query')),
    },
];

const localToolRegistry = new Map(localToolDefinitions.map((tool) => [tool.name, tool]));

export function getLocalTool(toolName: string): LocalToolDefinition | undefined {
    return localToolRegistry.get(toolName);
}

async function readFileTool(requestPath: string): Promise<string> {
    const filePath = resolveWorkspacePath(requestPath);
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    const truncated = bytes.length > MAX_READ_BYTES;
    const content = new TextDecoder().decode(truncated ? bytes.slice(0, MAX_READ_BYTES) : bytes);
    return truncated ? `${content}\n... [file truncated]` : content;
}

async function searchFilesTool(query: string): Promise<string> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        throw new Error('search_files requires a non-empty query');
    }

    const files = await vscode.workspace.findFiles(
        '**/*',
        '**/{.git,node_modules,dist,build,out,target,.gradle,.idea,.vscode-test}/**',
        500,
    );
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const matches = files
        .map((uri) => relativeWorkspacePath(uri.fsPath, workspaceFolders))
        .filter((filePath): filePath is string => Boolean(filePath))
        .filter((filePath) => filePath.toLowerCase().includes(normalizedQuery))
        .sort()
        .slice(0, MAX_SEARCH_RESULTS);

    return matches.length === 0
        ? `No workspace file paths matched query: ${query}`
        : matches.join('\n');
}

function readStringArg(toolCall: ToolCallRequest, name: string): string {
    const value = toolCall.arguments?.[name];
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${toolCall.toolName} requires a string '${name}' argument`);
    }
    return value;
}

function resolveWorkspacePath(requestPath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
        throw new Error('No VS Code workspace is open');
    }

    const candidate = path.isAbsolute(requestPath)
        ? path.normalize(requestPath)
        : path.normalize(path.join(workspaceFolders[0].uri.fsPath, requestPath));

    const workspaceRoot = workspaceFolders
        .map((folder) => path.normalize(folder.uri.fsPath))
        .find((root) => isInside(candidate, root));

    if (!workspaceRoot) {
        throw new Error('Tool path must stay inside an open workspace folder');
    }

    return candidate;
}

function relativeWorkspacePath(filePath: string, workspaceFolders: readonly vscode.WorkspaceFolder[]): string | undefined {
    const normalized = path.normalize(filePath);
    const root = workspaceFolders
        .map((folder) => path.normalize(folder.uri.fsPath))
        .find((workspaceRoot) => isInside(normalized, workspaceRoot));
    return root ? path.relative(root, normalized) : undefined;
}

function isInside(candidate: string, root: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
