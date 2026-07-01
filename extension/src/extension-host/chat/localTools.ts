import type { ToolCallRequest, ToolResultRequest } from './types';
import { getLocalTool } from './localToolRegistry';

export async function executeLocalTool(toolCall: ToolCallRequest): Promise<ToolResultRequest> {
    try {
        const tool = getLocalTool(toolCall.toolName);
        if (!tool) {
            return failure(toolCall, `Unsupported local tool: ${toolCall.toolName}`);
        }
        return success(toolCall, await tool.execute(toolCall));
    } catch (err) {
        return failure(toolCall, err instanceof Error ? err.message : String(err));
    }
}

function success(toolCall: ToolCallRequest, result: string): ToolResultRequest {
    return {
        runId: toolCall.runId,
        toolCallId: toolCall.toolCallId,
        status: 'SUCCEEDED',
        result,
    };
}

function failure(toolCall: ToolCallRequest, errorMessage: string): ToolResultRequest {
    return {
        runId: toolCall.runId,
        toolCallId: toolCall.toolCallId,
        status: 'FAILED',
        errorMessage,
    };
}
