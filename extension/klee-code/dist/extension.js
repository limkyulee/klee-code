"use strict";var w=Object.create;var d=Object.defineProperty;var f=Object.getOwnPropertyDescriptor;var y=Object.getOwnPropertyNames;var x=Object.getPrototypeOf,C=Object.prototype.hasOwnProperty;var k=(s,e)=>{for(var t in e)d(s,t,{get:e[t],enumerable:!0})},v=(s,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of y(e))!C.call(s,n)&&n!==t&&d(s,n,{get:()=>e[n],enumerable:!(o=f(e,n))||o.enumerable});return s};var l=(s,e,t)=>(t=s!=null?w(x(s)):{},v(e||!s||!s.__esModule?d(t,"default",{value:s,enumerable:!0}):t,s)),E=s=>v(d({},"__esModule",{value:!0}),s);var q={};k(q,{activate:()=>B,deactivate:()=>P});module.exports=E(q);var i=l(require("vscode"));var a=l(require("vscode")),p=require("crypto");var g=l(require("vscode"));var u="klee-code.backendUrl",m="/chat";function c(){return g.workspace.getConfiguration().get(u)}async function b(s){let e=`${c()}${m}`,t=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!t.ok)throw new Error(`HTTP ${t.status}: ${t.statusText}`);return t.json()}var r=class s{static viewType="klee-code.chatView";view;conversationId=(0,p.randomUUID)();async askFromInputBox(){await a.commands.executeCommand(`${s.viewType}.focus`);let e=await a.window.showInputBox({prompt:"Ask Klee Code...",placeHolder:"e.g. What does this code do?"});if(!e)return;let t=e.trim();t&&(await this.postMessage({type:"externalQuestion",question:t}),await this.ask(t))}async resetConversation(){await a.commands.executeCommand(`${s.viewType}.focus`),this.conversationId=(0,p.randomUUID)(),await this.postMessage({type:"conversationReset"}),a.window.showInformationMessage("Klee Code: New conversation started.")}resolveWebviewView(e){this.view=e,e.webview.options={enableScripts:!0},e.webview.html=this.getHtml(e.webview),e.webview.onDidReceiveMessage(t=>{this.handleMessage(t)})}async handleMessage(e){switch(e.type){case"ready":await this.postBackendStatus();return;case"newConversation":this.conversationId=(0,p.randomUUID)(),await this.postMessage({type:"conversationReset"});return;case"ask":await this.ask(e.question);return}}async ask(e){let t=e.trim();if(t){await this.postMessage({type:"requestStarted"});try{let o=a.window.activeTextEditor,n=o?.document.getText(o.selection)??"",h=await b({conversationId:this.conversationId,code:n,question:t});await this.postMessage({type:"response",answer:h.answer})}catch(o){await this.postMessage({type:"error",message:o instanceof Error?o.message:String(o)})}}}async postBackendStatus(){await this.postMessage({type:"status",backendUrl:c()})}async postMessage(e){await this.view?.webview.postMessage(e)}getHtml(e){let t=M();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${t}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Klee Code</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }

        .shell {
            display: grid;
            grid-template-rows: auto 1fr auto;
            height: 100vh;
            min-height: 0;
        }

        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 10px 10px 8px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
        }

        .title {
            min-width: 0;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .icon-button {
            display: inline-grid;
            place-items: center;
            width: 28px;
            height: 28px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            cursor: pointer;
        }

        .icon-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .status {
            padding: 6px 10px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .messages {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
            overflow-y: auto;
            padding: 12px 10px;
        }

        .empty {
            margin: auto 0;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5;
        }

        .message {
            display: grid;
            gap: 5px;
        }

        .role {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .bubble {
            width: 100%;
            padding: 9px 10px;
            border: 1px solid var(--vscode-input-border, var(--vscode-sideBar-border));
            border-radius: 6px;
            line-height: 1.45;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .message.user .bubble {
            background: var(--vscode-input-background);
        }

        .message.assistant .bubble {
            background: var(--vscode-editor-background);
        }

        .message.error .bubble {
            color: var(--vscode-errorForeground);
            border-color: var(--vscode-inputValidation-errorBorder);
            background: var(--vscode-inputValidation-errorBackground);
        }

        .composer {
            display: grid;
            gap: 8px;
            padding: 10px;
            border-top: 1px solid var(--vscode-sideBar-border);
        }

        textarea {
            width: 100%;
            min-height: 78px;
            max-height: 160px;
            resize: vertical;
            padding: 8px;
            color: var(--vscode-input-foreground);
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.4;
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
        }

        .send {
            min-width: 76px;
            height: 30px;
            padding: 0 12px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            cursor: pointer;
            font-weight: 600;
        }

        .send:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .send:disabled,
        textarea:disabled {
            opacity: 0.65;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="shell">
        <header>
            <div class="toolbar">
                <div class="title">Klee Code</div>
                <button class="icon-button" id="newConversation" type="button" title="New conversation" aria-label="New conversation">+</button>
            </div>
            <div class="status" id="status">Connecting...</div>
        </header>

        <main class="messages" id="messages">
            <div class="empty" id="empty">Ask about the selected code or the current workspace.</div>
        </main>

        <form class="composer" id="form">
            <textarea id="question" placeholder="Ask Klee Code..." rows="4"></textarea>
            <div class="actions">
                <button class="send" id="send" type="submit">Send</button>
            </div>
        </form>
    </div>

    <script nonce="${t}">
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const empty = document.getElementById('empty');
        const form = document.getElementById('form');
        const question = document.getElementById('question');
        const send = document.getElementById('send');
        const status = document.getElementById('status');
        const newConversation = document.getElementById('newConversation');

        let pending = false;

        function setPending(value) {
            pending = value;
            question.disabled = value;
            send.disabled = value;
            send.textContent = value ? 'Sending' : 'Send';
        }

        function addMessage(role, text, variant) {
            empty.hidden = true;

            const item = document.createElement('article');
            item.className = 'message ' + (variant || role.toLowerCase());

            const label = document.createElement('div');
            label.className = 'role';
            label.textContent = role;

            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.textContent = text;

            item.append(label, bubble);
            messages.append(item);
            messages.scrollTop = messages.scrollHeight;
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const text = question.value.trim();
            if (!text || pending) {
                return;
            }

            addMessage('You', text, 'user');
            question.value = '';
            vscode.postMessage({ type: 'ask', question: text });
        });

        question.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                form.requestSubmit();
            }
        });

        newConversation.addEventListener('click', () => {
            vscode.postMessage({ type: 'newConversation' });
        });

        window.addEventListener('message', (event) => {
            const message = event.data;

            if (message.type === 'status') {
                status.textContent = 'Backend: ' + message.backendUrl;
            }

            if (message.type === 'requestStarted') {
                setPending(true);
            }

            if (message.type === 'externalQuestion') {
                addMessage('You', message.question, 'user');
            }

            if (message.type === 'response') {
                setPending(false);
                addMessage('Assistant', message.answer, 'assistant');
            }

            if (message.type === 'error') {
                setPending(false);
                addMessage('Error', message.message, 'error');
            }

            if (message.type === 'conversationReset') {
                messages.querySelectorAll('.message').forEach((node) => node.remove());
                empty.hidden = false;
                status.textContent = 'New conversation';
            }
        });

        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`}};function M(){let s="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",e="";for(let t=0;t<32;t+=1)e+=s.charAt(Math.floor(Math.random()*s.length));return e}function B(s){let e=new r,t=i.window.registerWebviewViewProvider(r.viewType,e),o=i.commands.registerCommand("klee-code.askAssistant",async()=>{await e.askFromInputBox()}),n=i.commands.registerCommand("klee-code.newConversation",async()=>{await e.resetConversation()});s.subscriptions.push(t,o,n)}function P(){}0&&(module.exports={activate,deactivate});
