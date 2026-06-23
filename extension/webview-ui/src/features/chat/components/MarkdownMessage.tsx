import hljs from 'highlight.js/lib/common';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type MarkdownBlock =
    | { type: 'paragraph'; text: string }
    | { type: 'heading'; level: HeadingLevel; text: string }
    | { type: 'list'; ordered: boolean; items: string[] }
    | { type: 'code'; language: string; code: string };

interface CodeFence {
    marker: '`' | '~';
    length: number;
    language: string;
}

interface MarkdownMessageProps {
    text: string;
}

export function MarkdownMessage({ text }: MarkdownMessageProps) {
    return (
        <div className="markdown-message">
            {parseMarkdown(text).map((block, index) => (
                <MarkdownBlockView key={`${block.type}-${index}`} block={block} />
            ))}
        </div>
    );
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
    if (block.type === 'code') {
        return <CodeBlockView block={block} />;
    }

    if (block.type === 'heading') {
        return renderHeading(block.level, renderInlineMarkdown(block.text));
    }

    if (block.type === 'list') {
        const List = block.ordered ? 'ol' : 'ul';
        return (
            <List className="markdown-list">
                {block.items.map((item, index) => (
                    <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
                ))}
            </List>
        );
    }

    return <p className="markdown-paragraph">{renderInlineMarkdown(block.text)}</p>;
}

function CodeBlockView({ block }: { block: Extract<MarkdownBlock, { type: 'code' }> }) {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    const languageLabel = getDisplayLanguage(block.language);
    const highlightedCode = useMemo(() => highlightCode(block.code, block.language), [block.code, block.language]);

    useEffect(() => {
        if (copyStatus === 'idle') {
            return;
        }

        const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 1600);
        return () => window.clearTimeout(timeoutId);
    }, [copyStatus]);

    const handleCopy = async () => {
        try {
            await copyToClipboard(block.code);
            setCopyStatus('copied');
        } catch {
            setCopyStatus('failed');
        }
    };

    return (
        <figure className="markdown-code-block">
            <figcaption className="markdown-code-header">
                <span className="markdown-code-language">{languageLabel}</span>
                <button
                    type="button"
                    className={`markdown-code-copy markdown-code-copy-${copyStatus}`}
                    onClick={handleCopy}
                    aria-label={copyStatus === 'copied' ? '코드 복사 완료' : '코드 복사'}
                    title={copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy code'}
                >
                    <span className="markdown-code-copy-icon" aria-hidden="true" />
                </button>
            </figcaption>
            <pre>
                <code
                    className={`hljs language-${getLanguageClassName(block.language)}`}
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
            </pre>
        </figure>
    );
}

function renderHeading(level: HeadingLevel, content: ReactNode[]) {
    switch (level) {
        case 1:
            return <h1 className="markdown-heading">{content}</h1>;
        case 2:
            return <h2 className="markdown-heading">{content}</h2>;
        case 3:
            return <h3 className="markdown-heading">{content}</h3>;
        case 4:
            return <h4 className="markdown-heading">{content}</h4>;
        case 5:
            return <h5 className="markdown-heading">{content}</h5>;
        case 6:
            return <h6 className="markdown-heading">{content}</h6>;
    }
}

async function copyToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('Copy command failed');
        }
    } finally {
        document.body.removeChild(textarea);
    }
}

function getDisplayLanguage(language: string) {
    return normalizeLanguage(language) || 'plain text';
}

function getLanguageClassName(language: string) {
    return normalizeLanguage(language).replace(/[^a-z0-9_-]/g, '-') || 'plain-text';
}

function normalizeLanguage(language: string) {
    return language.trim().split(/\s+/, 1)[0].toLowerCase();
}

function highlightCode(code: string, language: string) {
    const normalizedLanguage = normalizeLanguage(language);

    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
        return hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value;
    }

    return hljs.highlightAuto(code).value;
}

function parseMarkdown(source: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    const proseLines: string[] = [];
    let codeLanguage = '';
    let codeLines: string[] = [];
    let activeFence: CodeFence | null = null;
    let inCodeBlock = false;

    const flushProse = () => {
        if (proseLines.length === 0) {
            return;
        }

        blocks.push(...parseProseBlocks(proseLines));
        proseLines.length = 0;
    };

    for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
        const openingFence = parseOpeningFence(line);

        if (inCodeBlock) {
            if (activeFence && isClosingFence(line, activeFence)) {
                blocks.push({ type: 'code', language: codeLanguage.trim(), code: codeLines.join('\n') });
                codeLanguage = '';
                codeLines = [];
                activeFence = null;
                inCodeBlock = false;
            } else {
                codeLines.push(line);
            }
            continue;
        }

        if (openingFence) {
            flushProse();
            codeLanguage = openingFence.language;
            codeLines = [];
            activeFence = openingFence;
            inCodeBlock = true;
            continue;
        }

        proseLines.push(line);
    }

    if (inCodeBlock) {
        blocks.push({ type: 'code', language: codeLanguage.trim(), code: codeLines.join('\n') });
    }
    flushProse();

    return blocks;
}

function parseOpeningFence(line: string): CodeFence | null {
    const trimmedStart = line.trimStart();
    const marker = trimmedStart[0];

    if (marker !== '`' && marker !== '~') {
        return null;
    }

    let length = 0;
    while (trimmedStart[length] === marker) {
        length += 1;
    }

    if (length < 3) {
        return null;
    }

    const language = trimmedStart.slice(length).trim();
    if (marker === '`' && language.includes('`')) {
        return null;
    }

    return { marker, length, language };
}

function isClosingFence(line: string, fence: CodeFence): boolean {
    const trimmed = line.trim();
    let length = 0;

    while (trimmed[length] === fence.marker) {
        length += 1;
    }

    return length >= fence.length && trimmed.slice(length).trim() === '';
}

function parseProseBlocks(lines: string[]): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];
    let listOrdered = false;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) {
            return;
        }

        blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
        paragraphLines = [];
    };

    const flushList = () => {
        if (listItems.length === 0) {
            return;
        }

        blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
        listItems = [];
    };

    for (const line of lines) {
        if (line.trim() === '') {
            flushParagraph();
            flushList();
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
                text: headingMatch[2],
            });
            continue;
        }

        const orderedListMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (orderedListMatch) {
            flushParagraph();
            if (listItems.length > 0 && !listOrdered) {
                flushList();
            }
            listOrdered = true;
            listItems.push(orderedListMatch[1]);
            continue;
        }

        const unorderedListMatch = line.match(/^\s*[-*+]\s+(.+)$/);
        if (unorderedListMatch) {
            flushParagraph();
            if (listItems.length > 0 && listOrdered) {
                flushList();
            }
            listOrdered = false;
            listItems.push(unorderedListMatch[1]);
            continue;
        }

        flushList();
        paragraphLines.push(line);
    }

    flushParagraph();
    flushList();

    return blocks;
}

function renderInlineMarkdown(source: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+?\*\*)/g;
    let lastIndex = 0;

    for (const match of source.matchAll(tokenPattern)) {
        if (match.index > lastIndex) {
            nodes.push(source.slice(lastIndex, match.index));
        }

        const token = match[0];
        const key = `${token}-${match.index}`;
        if (token.startsWith('`')) {
            nodes.push(
                <code key={key} className="markdown-inline-code">
                    {token.slice(1, -1)}
                </code>
            );
        } else {
            nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
        }

        lastIndex = match.index + token.length;
    }

    if (lastIndex < source.length) {
        nodes.push(source.slice(lastIndex));
    }

    return nodes;
}
