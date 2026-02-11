/**
 * Standardized error response helpers
 */
export function createErrorResponse(message, possibleSolutions = []) {
    console.error(`[SERVER] Error response: ${message}`);
    if (possibleSolutions.length > 0) {
        console.error(`[SERVER] Possible solutions: ${possibleSolutions.join(', ')}`);
    }
    const response = {
        content: [
            {
                type: 'text',
                text: message,
            },
        ],
        isError: true,
    };
    if (possibleSolutions.length > 0) {
        response.content.push({
            type: 'text',
            text: 'Possible solutions:\n- ' + possibleSolutions.join('\n- '),
        });
    }
    return response;
}
export function createTextResponse(text) {
    return {
        content: [
            {
                type: 'text',
                text,
            },
        ],
    };
}
export function createImageResponse(base64Data, mimeType = 'image/png', text) {
    const content = [
        {
            type: 'image',
            data: base64Data,
            mimeType,
        },
    ];
    if (text) {
        content.push({ type: 'text', text });
    }
    return { content };
}
