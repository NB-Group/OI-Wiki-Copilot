// ===== OI COPilot CONTENT SCRIPT =====

// --- Global State Variables ---
let tooltip;
let aiDialog = null;
let isDragging = false;
let conversationHistory = [];
let currentSelectionText = '';
let currentPageContext = '';
// Store original texts for undo
let originalTexts = {};


// --- Function Definitions ---

// This function checks for any pending actions stored by the background script.
async function handlePendingAction() {
    const getTabId = () => new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, response => {
            if (chrome.runtime.lastError) {
                console.error('Could not get Tab ID:', chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(response.tabId);
            }
        });
    });

    const [myTabId, { pendingAction }] = await Promise.all([
        getTabId(),
        chrome.storage.local.get('pendingAction')
    ]);

    if (!myTabId) {
        console.error("Could not verify pending action because Tab ID is missing.");
        return;
    }

    if (pendingAction && pendingAction.tabId === myTabId) {
        console.log('🚀 Found pending action:', pendingAction);
        
        // Clear the action so it doesn't run again on the next load.
        await chrome.storage.local.remove('pendingAction');

        // Execute the action.
        switch (pendingAction.action) {
            case 'ask-ai':
                handleAskAiAction(pendingAction.selectionText);
                break;
            case 'rewrite-text':
                const selection = window.getSelection();
                // For rewrite, selection text must still be present.
                if (selection && selection.toString().trim() && selection.toString().trim() === pendingAction.selectionText.trim()) {
                    rewriteText(selection);
                } else {
                     console.warn('Selection for rewrite action was lost or changed.');
                }
                break;
        }
    }
}

function handleAskAiAction(selectionText) {
    createAiDialog();
    
    conversationHistory = [];
    currentSelectionText = selectionText || '';

    currentPageContext = getVisiblePageContent();
    
    const systemContext = `你是一个专业的算法竞赛教练和计算机科学专家，名叫OI Copilot。用户正在阅读 OI-Wiki 的以下内容：

===== 页面内容 =====
${currentPageContext}
===== 页面内容结束 =====

请基于以上内容回答用户的问题，用通俗易懂的语言解释算法和数据结构概念。`;
    
    conversationHistory.push({ role: 'system', content: systemContext });

    const messagesDiv = document.getElementById('ai-dialog-messages');
    messagesDiv.innerHTML = '';
    
    const inputArea = document.getElementById('ai-dialog-input');
    if (currentSelectionText) {
        inputArea.placeholder = `已引用选中内容，请提问...`;
        const hintDiv = document.createElement('div');
        hintDiv.className = 'ai-message system-message';
        hintDiv.innerHTML = `<div class="message-content">📎 已引用选中内容: "${currentSelectionText.substring(0, 100)}${currentSelectionText.length > 100 ? '...' : ''}"</div>`;
        messagesDiv.appendChild(hintDiv);
    } else {
        inputArea.placeholder = `向 AI 提问...`;
    }
    
    aiDialog.style.display = 'flex';
    setTimeout(() => {
        aiDialog.classList.add('show');
        inputArea.focus();
    }, 10);
}

/**
 * Finds all text nodes in the document body that are not inside scripts, styles, or links,
 * and replaces occurrences of annotation keywords with a styled <span> element.
 * @param {Object} annotations - An object where keys are keywords and values are their annotations.
 */
function highlightAnnotations(annotations) {
  // Sort keys by length, descending, to prioritize longer matches
  const keywords = Object.keys(annotations).sort((a, b) => b.length - a.length);
  if (keywords.length === 0) return;

  const regexParts = keywords.map(key => {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (/^[a-zA-Z0-9_]+$/.test(key)) {
      return `\\b${escapedKey}\\b`;
    } else {
      return escapedKey;
    }
  });

  const regex = new RegExp(`(${regexParts.join('|')})`, 'gu');
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (node.parentElement.closest('script, style, a, .annotation-highlight')) continue;
    textNodes.push(node);
  }

  textNodes.forEach(node => {
    if (regex.test(node.nodeValue)) {
      const fragment = document.createDocumentFragment();
      const parts = node.nodeValue.split(regex);
      parts.forEach((part, index) => {
        if (index % 2 === 1) {
          const annotationValue = annotations[part];
          if (annotationValue) {
            const span = document.createElement('span');
            span.className = 'annotation-highlight';
            span.textContent = part;
            span.dataset.annotation = annotationValue;
            fragment.appendChild(span);
          } else {
            fragment.appendChild(document.createTextNode(part));
          }
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      if (fragment.childNodes.length > 0) node.parentNode.replaceChild(fragment, node);
    }
  });
}

/* A robust function to render content with LaTeX and styled English text */
function renderContent(text) {
  try {
    const parts = text.split(/(\$\$[^]*?\$\$|\$[^]*?\$)/g);
    const renderedParts = parts.map((part, index) => {
      if (index % 2 === 1) {
        try {
          if (part.startsWith('$$')) {
            const latex = part.slice(2, -2);
            return katex.renderToString(latex, { displayMode: true, throwOnError: true });
          } else {
            const latex = part.slice(1, -1);
            return katex.renderToString(latex, { displayMode: false, throwOnError: true });
          }
        } catch (error) {
          const escaper = document.createElement('div');
          escaper.textContent = part;
          return escaper.innerHTML;
        }
      } else {
        const escaper = document.createElement('div');
        escaper.textContent = part;
        const safePart = escaper.innerHTML;
        return safePart.replace(/\b([a-zA-Z]{2,})\b/g, (match) => `<span class="math-font">${match}</span>`);
      }
    });
    return renderedParts.join('');
  } catch (error) {
    const escaper = document.createElement('div');
    escaper.textContent = text;
    return escaper.innerHTML;
  }
}

function renderMarkdownWithKatex(text) {
  try {
    let html = text;
    const esc = document.createElement('div');
    esc.textContent = html;
    html = esc.innerHTML;
    html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
               .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
               .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
               .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
               .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
               .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/`([^`]+)`/g, '<code>$1</code>')
               .replace(/\[(.*?)\]\((https?:[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1<\/a>');
    html = html.replace(/^(?:- |\* )(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
    html = html.replace(/\$\$([^]*?)\$\$/g, (m, p1) => { try { return katex.renderToString(p1, { displayMode: true, throwOnError: true }); } catch { return m; } });
    html = html.replace(/\\\[([^]*?)\\\]/g, (m, p1) => { try { return katex.renderToString(p1, { displayMode: true, throwOnError: true }); } catch { return m; } });
    html = html.replace(/\$([^$\n]+?)\$/g, (m, p1) => { try { return katex.renderToString(p1.trim(), { displayMode: false, throwOnError: true }); } catch { return m; } });
    html = html.replace(/(?<!\\)\\\(([\s\S]+?)\\\)/g, (m, p1) => { try { return katex.renderToString(p1.trim(), { displayMode: false, throwOnError: true }); } catch { return m; } });
    html = html.split(/\n{2,}/).map(p => /^\s*<h\d|^\s*<ul|^\s*<p|^\s*<div|^\s*<table|^\s*<pre/.test(p) ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    return html;
  } catch (e) {
    return renderContent(text);
  }
}

function showTooltip(event) {
  if (event.target.classList.contains('annotation-highlight')) {
    const annotationText = event.target.dataset.annotation;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'annotation-tooltip';
      document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = renderContent(annotationText);
    tooltip.classList.add('visible');
  }
}

function hideTooltip(event) {
  if (event.target.classList.contains('annotation-highlight')) {
    if (tooltip) tooltip.classList.remove('visible');
  }
}

function moveTooltip(event) {
  if (!tooltip) return;
  tooltip.style.left = `${event.pageX + 15}px`;
  tooltip.style.top = `${event.pageY + 15}px`;
}

function init() {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'annotation-tooltip';
    document.body.appendChild(tooltip);
  }
  chrome.storage.sync.get('annotations', (data) => {
    if (data.annotations) highlightAnnotations(data.annotations);
  });
  document.body.addEventListener('mouseover', showTooltip);
  document.body.addEventListener('mouseout', hideTooltip);
  document.body.addEventListener('mousemove', moveTooltip);
}

function createAiDialog() {
    if (aiDialog) return;

    aiDialog = document.createElement('div');
    aiDialog.id = 'ai-dialog';
    aiDialog.innerHTML = `
        <div id="ai-dialog-header">
            <span>OI-Wiki Copilot</span>
            <button id="ai-dialog-close"><svg xmlns="http://www.w3.org/2000/svg" class="iconify-icon iconify-inline" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"></path></svg></button>
        </div>
        <div id="ai-dialog-messages"></div>
        <div id="ai-dialog-input-container">
            <textarea id="ai-dialog-input" placeholder="向 AI 提问..." rows="1"></textarea>
            <button id="ai-dialog-send">发送</button>
        </div>
    `;
    document.body.appendChild(aiDialog);

    const closeButton = document.getElementById('ai-dialog-close');
    const sendButton = document.getElementById('ai-dialog-send');
    const inputArea = document.getElementById('ai-dialog-input');
    const header = document.getElementById('ai-dialog-header');

    closeButton.addEventListener('click', () => {
        aiDialog.classList.remove('show');
        setTimeout(() => {
            aiDialog.style.display = 'none';
        }, 200);
        conversationHistory = [];
    });
    
    sendButton.addEventListener('click', sendAiMessage);
    
    // Auto-resize textarea
    inputArea.addEventListener('input', () => {
        inputArea.style.height = 'auto';
        inputArea.style.height = Math.min(inputArea.scrollHeight, 100) + 'px';
    });
    
    // Enter to send (Shift+Enter for new line)
    inputArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAiMessage();
        }
    });
    
    // Make dialog draggable with proper top/left positioning
    let startX, startY, initialLeft, initialTop;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = aiDialog.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        // Ensure the dialog has position absolute for dragging
        aiDialog.style.position = 'fixed';
        aiDialog.style.left = initialLeft + 'px';
        aiDialog.style.top = initialTop + 'px';
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newLeft = Math.max(0, Math.min(window.innerWidth - aiDialog.offsetWidth, initialLeft + deltaX));
        const newTop = Math.max(0, Math.min(window.innerHeight - aiDialog.offsetHeight, initialTop + deltaY));
        
        aiDialog.style.left = newLeft + 'px';
        aiDialog.style.top = newTop + 'px';
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

async function sendAiMessage() {
    const inputArea = document.getElementById('ai-dialog-input');
    const messagesDiv = document.getElementById('ai-dialog-messages');
    const userMessage = inputArea.value.trim();

    if (!userMessage) return;

    // Add user message to UI
    const userDiv = document.createElement('div');
    userDiv.className = 'ai-message user-message';
    userDiv.innerHTML = `<div class="message-content">${escapeHtml(userMessage)}</div>`;
    messagesDiv.appendChild(userDiv);

    inputArea.value = '';
    inputArea.style.height = 'auto';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Create the assistant's message container with a "thinking" state
    const assistantDiv = document.createElement('div');
    assistantDiv.className = 'ai-message assistant-message';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content thinking';
    contentDiv.textContent = '正在思考...';
    assistantDiv.appendChild(contentDiv);
    messagesDiv.appendChild(assistantDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Prepare messages for AI
    let messages = [...conversationHistory];
    
    let messageWithContext = userMessage;
    if (currentSelectionText) {
        messageWithContext = `【引用内容】: "${currentSelectionText}"\n\n【我的问题】: ${userMessage}`;
    }

    messages.push({ role: 'user', content: messageWithContext });

    const port = chrome.runtime.connect({name: "ai_stream"});
    port.postMessage({ type: 'CALL_AI', messages: messages });

    let fullResponse = '';
    let firstChunkReceived = false;

    port.onMessage.addListener((msg) => {
        if (msg.type === 'AI_CHUNK') {
            if (!firstChunkReceived) {
                // On first chunk, remove "thinking" state and clear content
                contentDiv.textContent = '';
                contentDiv.classList.remove('thinking');
                firstChunkReceived = true;
            }
            if (msg.chunk.choices && msg.chunk.choices[0].delta && msg.chunk.choices[0].delta.content) {
                const content = msg.chunk.choices[0].delta.content;
                fullResponse += content;
                contentDiv.innerHTML = renderMarkdownWithKatex(fullResponse);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        } else if (msg.type === 'AI_STREAM_DONE') {
            // Update conversation history with the final full response
            conversationHistory.push({ role: 'user', content: messageWithContext });
            conversationHistory.push({ role: 'assistant', content: fullResponse });
            port.disconnect();
        } else if (msg.type === 'AI_STREAM_ERROR') {
             if (!firstChunkReceived) {
                contentDiv.classList.remove('thinking');
            }
            contentDiv.innerHTML = `<div class="message-content error">出错了: ${msg.error}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            port.disconnect();
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getVisiblePageContent() {
    // Get the specific OI-Wiki content area
    const mainContent = document.querySelector('.md-content__inner.md-typeset') || 
                       document.querySelector('article') || 
                       document.querySelector('main') || 
                       document.body;
    
    // Extract text content, limiting to a reasonable length
    const textContent = mainContent.innerText || mainContent.textContent || '';
    
    // Limit to first 4000 characters to stay within token limits
    return textContent.substring(0, 4000).trim();
}

// Promise wrapper around chrome.runtime.sendMessage with lastError handling
function sendMessageSafe(payload) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage(payload, (response) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    reject(new Error(err.message || 'Unknown messaging error'));
                    return;
                }
                resolve(response);
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function rewriteText(selection) {
    const selectedText = selection.toString();
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    
    // Create a unique ID for this rewrite operation
    const rewriteId = `rewrite-${Date.now()}`;
    
    // Wrap the selection in a span to mark it
    const span = document.createElement('span');
    span.className = 'ai-rewrite-placeholder';
    span.id = rewriteId;
    span.textContent = "AI 正在重写...";
    range.deleteContents();
    range.insertNode(span);

    // Store original content
    originalTexts[rewriteId] = selectedText;

    const prompt = `你是一个专业的算法竞赛（ICPC）教练和计算机科学（CS）领域的专家。请在完整保留原始信息和专业性的前提下，将以下文本重写得更清晰、更易于初学者理解。请特别注意消除 "不难看出", "显而易见", "注意到", "易得" 这类模糊的、对初学者不友好的表述，并用更具体的解释来代替。

原始文本如下：
---
${selectedText}
---

请直接输出重写后的文本，不要包含任何额外的解释或开场白。`;

    const messages = [{ role: 'user', content: prompt }];

    try {
        const response = await chrome.runtime.sendMessage({ type: 'CALL_AI', messages: messages });
        if (!response || response.success === false) {
            throw new Error(response && response.error ? response.error : '模型响应为空');
        }

        const rewrittenText = response.content;
        
        const contentSpan = document.createElement('span');
        contentSpan.innerHTML = renderMarkdownWithKatex(rewrittenText);
        
        const undoButton = document.createElement('button');
        undoButton.className = 'ai-rewrite-undo';
        undoButton.textContent = '撤销';
        undoButton.onclick = () => undoRewrite(rewriteId, contentSpan, undoButton);

        span.innerHTML = '';
        span.className = 'ai-rewritten-text';
        span.appendChild(contentSpan);
        span.appendChild(undoButton);
        
        // Persist the change
        saveRewrite(rewriteId, rewrittenText);

    } catch (error) {
        span.textContent = `重写失败: ${error.message}`;
        span.style.color = 'red';
    }
}

function undoRewrite(id, content, button) {
    const container = document.getElementById(id);
    container.innerHTML = originalTexts[id];
    delete originalTexts[id];
    removeRewrite(id); // Remove from persistent storage
}

function saveRewrite(id, content) {
    chrome.storage.local.get(['rewrites'], (result) => {
        const rewrites = result.rewrites || {};
        rewrites[window.location.href] = rewrites[window.location.href] || {};
        rewrites[window.location.href][id] = content;
        chrome.storage.local.set({ rewrites: rewrites });
    });
}

function removeRewrite(id) {
    chrome.storage.local.get(['rewrites'], (result) => {
        const rewrites = result.rewrites || {};
        if (rewrites[window.location.href]) {
            delete rewrites[window.location.href][id];
            chrome.storage.local.set({ rewrites: rewrites });
        }
    });
}

function applySavedRewrites() {
    chrome.storage.local.get(['rewrites'], (result) => {
        const rewrites = result.rewrites || {};
        const pageRewrites = rewrites[window.location.href];
        if (pageRewrites) {
            for (const id in pageRewrites) {
                const element = document.getElementById(id);
                if (element) {
                    // This is a simplified application logic.
                    // A more robust version would save the original text and selector.
                    element.innerHTML = pageRewrites[id];
                }
            }
        }
    });
}
// Note: A robust way to apply rewrites on page load would require saving selectors,
// as IDs might not persist. For this version, we assume IDs are stable enough.


// --- Initialization Logic ---

// Load guard to prevent multiple executions of one-time setup
if (window.oiCopilotHasLoaded) {
  console.log('🚀 OI Copilot content script already loaded. Skipping re-initialization.');
} else {
  window.oiCopilotHasLoaded = true;
  console.log('🚀 OI Copilot content script starting initialization...');

  // Run one-time setup
  init();

  // Add event listeners that should only be attached once
  document.addEventListener('selectionchange', () => {
      if (aiDialog && aiDialog.style.display === 'flex') {
          const selection = window.getSelection();
          // Ignore selections made inside the AI dialog itself
          if (selection.rangeCount > 0) {
              const anc = selection.anchorNode && selection.anchorNode.parentElement;
              if (anc && anc.closest && anc.closest('#ai-dialog')) {
                  return;
              }
          }
          if (selection.rangeCount > 0 && selection.toString().trim()) {
              currentSelectionText = selection.toString().trim();
              const inputArea = document.getElementById('ai-dialog-input');
              const messagesDiv = document.getElementById('ai-dialog-messages');
              
              // Update placeholder
              inputArea.placeholder = `已引用新选中内容，请提问...`;
              
              // Add or update hint message
              const existingHint = messagesDiv.querySelector('.system-message');
              if (existingHint) {
                  existingHint.querySelector('.message-content').innerHTML = 
                      `📎 已引用新选中内容: "${currentSelectionText.substring(0, 100)}${currentSelectionText.length > 100 ? '...' : ''}"`;
              } else {
                  const hintDiv = document.createElement('div');
                  hintDiv.className = 'ai-message system-message';
                  hintDiv.innerHTML = `<div class="message-content">📎 已引用新选中内容: "${currentSelectionText.substring(0, 100)}${currentSelectionText.length > 100 ? '...' : ''}"</div>`;
                  messagesDiv.insertBefore(hintDiv, messagesDiv.firstChild);
              }
          }
      }
  });

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Content script received message:', request.type, request);
      if (request.type === 'PING') {
          sendResponse({ pong: true, url: window.location.href, timestamp: Date.now() });
          return true;
      }
      if (request.type === 'PROCESS_PENDING_ACTION') {
          handlePendingAction()
              .then(() => sendResponse({ done: true }))
              .catch(() => sendResponse({ done: false }));
          return true;
      }
      if (request.type === 'ANNOTATION_ADDED') {
          window.location.reload();
      }
  });

  // Initial check for pending actions on first load
  handlePendingAction();
  
  console.log('✅ OI Copilot one-time initialization complete.');
}
