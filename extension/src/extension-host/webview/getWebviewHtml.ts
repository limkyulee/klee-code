import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'app.js')
    );
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'app.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Klee Code</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';

    for (let i = 0; i < 32; i += 1) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return nonce;
}
