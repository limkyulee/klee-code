export type LocalSlashCommandName = 'clear' | 'help' | 'status';

export interface LocalSlashCommandDefinition {
    name: LocalSlashCommandName;
    description: string;
}

export interface ParsedPromptSkillCommand {
    skillCommand?: { name: string };
    question: string;
}

export type ParsedSlashCommand =
    | { type: 'local'; name: LocalSlashCommandName; args: string }
    | { type: 'promptSkill'; skillCommand: { name: string }; question: string }
    | { type: 'text'; question: string };

const SLASH_SKILL_PATTERN = /^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/;

export const LOCAL_SLASH_COMMANDS: readonly LocalSlashCommandDefinition[] = [
    {
        name: 'clear',
        description: '현재 대화 내역과 context window를 초기화합니다.',
    },
    {
        name: 'help',
        description: '사용 가능한 slash command와 .klee 커스터마이징 규칙을 표시합니다.',
    },
    {
        name: 'status',
        description: '현재 백엔드 연결과 모델 설정 상태를 표시합니다.',
    },
];

const localCommandNames = new Set<string>(LOCAL_SLASH_COMMANDS.map((command) => command.name));

export function parseSlashCommand(text: string): ParsedSlashCommand {
    const trimmedText = text.trim();
    const match = SLASH_SKILL_PATTERN.exec(trimmedText);

    if (!match) {
        return { type: 'text', question: trimmedText };
    }

    const name = match[1].toLowerCase();
    const args = match[2]?.trim() ?? '';

    if (isLocalSlashCommandName(name)) {
        return { type: 'local', name, args };
    }

    return {
        type: 'promptSkill',
        skillCommand: { name },
        question: args,
    };
}

export function parseSlashSkillCommand(text: string): ParsedPromptSkillCommand {
    const command = parseSlashCommand(text);

    if (command.type === 'promptSkill') {
        return {
            skillCommand: command.skillCommand,
            question: command.question,
        };
    }

    return {
        question: command.type === 'text' ? command.question : command.args,
    };
}

function isLocalSlashCommandName(name: string): name is LocalSlashCommandName {
    return localCommandNames.has(name);
}
