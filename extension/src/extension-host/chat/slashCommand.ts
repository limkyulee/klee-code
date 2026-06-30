export interface ParsedSlashCommand {
    skillCommand?: { name: string };
    question: string;
}

const SLASH_SKILL_PATTERN = /^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/;
const CLEAR_COMMAND_PATTERN = /^\/clear(?:\s+.*)?$/i;

export function parseSlashSkillCommand(text: string): ParsedSlashCommand {
    const trimmedText = text.trim();
    const match = SLASH_SKILL_PATTERN.exec(trimmedText);

    if (!match) {
        return { question: trimmedText };
    }

    return {
        skillCommand: { name: match[1].toLowerCase() },
        question: match[2]?.trim() ?? '',
    };
}

export function isClearCommand(text: string): boolean {
    return CLEAR_COMMAND_PATTERN.test(text.trim());
}
