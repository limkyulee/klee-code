import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatView } from './features/chat/ChatView';
import 'highlight.js/styles/github-dark.css';
import './styles/global.css';

const root = document.getElementById('root');

if (root) {
    createRoot(root).render(
        <StrictMode>
            <ChatView />
        </StrictMode>,
    );
}
