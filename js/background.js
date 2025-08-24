// Pre-defined annotations
const predefinedAnnotations = {
  "松弛": "在最短路算法中，松弛操作是指更新从源点到某个顶点的最短距离估计值。如果通过一个新路径可以得到更短的距离，则更新该顶点的距离值。",
  "border": "在KMP算法中，字符串的border是指既是该字符串的前缀又是其后缀的字符串。例如，'ababa'的border有'a'和'aba'。",
  "pi数组": "在KMP算法中，pi数组（也叫next数组）存储了字符串每个前缀的最长border的长度。它用于在文本匹配中高效地移动模式串的位置。",
  "度": "在图论中，一个顶点的度（degree）是指与该顶点相关联的边的数量，记作 $d(v) = |N(v)|$，其中 $N(v)$ 是顶点 $v$ 的邻居集合。"
};

// Default settings
const defaultContextMenuSettings = {
  contextMenu_addAnnotation: true,
  contextMenu_search: true,
  contextMenu_askAI: true,
  contextMenu_rewrite: true
};

function updateContextMenus() {
  chrome.storage.sync.get(defaultContextMenuSettings, (settings) => {
    chrome.contextMenus.removeAll(() => {
      if (settings.contextMenu_addAnnotation) {
        chrome.contextMenus.create({
          id: "add-annotation-on-oi-wiki",
          title: "添加 OI-Wiki 注释",
          contexts: ["selection"],
          documentUrlPatterns: ["https://oi-wiki.org/*"]
        });
      }
      if (settings.contextMenu_search) {
        chrome.contextMenus.create({
          id: "search-on-oi-wiki",
          title: "在 OI-Wiki 中查询",
          contexts: ["selection"]
        });
      }
      if (settings.contextMenu_askAI) {
        chrome.contextMenus.create({
          id: "ask-ai",
          title: "对 AI 提问",
          contexts: ["all"]
        });
      }
      if (settings.contextMenu_rewrite) {
        chrome.contextMenus.create({
          id: "rewrite-text",
          title: "优化此段落 (AI)",
          contexts: ["selection"],
          documentUrlPatterns: ["https://oi-wiki.org/*"]
        });
      }
    });
  });
}

// On extension installation, create context menu items
chrome.runtime.onInstalled.addListener((details) => {
  // On first install, open the settings page
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'settings.html' });
  }

  // Store predefined annotations (runs on install/update as well)
  chrome.storage.sync.get('annotations', (data) => {
    const existingAnnotations = data.annotations || {};
    const newAnnotations = { ...predefinedAnnotations, ...existingAnnotations };
    chrome.storage.sync.set({ annotations: newAnnotations });
  });
  
  updateContextMenus();
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case "add-annotation-on-oi-wiki":
            // This action is handled by injecting a function directly.
            if (info.selectionText) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: promptForAnnotation,
                    args: [info.selectionText]
                });
            }
            break;

        case "search-on-oi-wiki":
            // This action is handled entirely in the background script.
            if (info.selectionText) {
                const searchUrl = `https://oi-wiki.org/?q=${encodeURIComponent(info.selectionText)}`;
                chrome.tabs.create({ url: searchUrl });
            }
            break;

        case 'ask-ai':
        case 'rewrite-text':
            // These actions require the content script. We use the robust storage method.
            await chrome.storage.local.set({
                pendingAction: {
                    tabId: tab.id,
                    action: info.menuItemId,
                    selectionText: info.selectionText || ""
                }
            });

            // Try to trigger the content script immediately via direct message first
            {
                const triggered = await new Promise((resolve) => {
                    try {
                        chrome.tabs.sendMessage(tab.id, { type: 'PROCESS_PENDING_ACTION' }, (resp) => {
                            if (chrome.runtime.lastError) {
                                resolve(false);
                            } else {
                                resolve(resp && resp.done);
                            }
                        });
                    } catch (e) {
                        resolve(false);
                    }
                });

                // Fallback to executing a function in the page if messaging didn't work
                if (!triggered) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            function: () => {
                                if (typeof handlePendingAction === 'function') {
                                    handlePendingAction();
                                }
                            }
                        });
                    } catch (e) {
                        console.error('Failed to execute function in content script. The action will be handled on next page load.', e);
                    }
                }
            }
            break;
    }
});


// Listen for port connections from content scripts for AI streaming
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'ai_stream') {
        return;
    }

    port.onMessage.addListener(async (msg) => {
        if (msg.type === 'CALL_AI') {
            chrome.storage.sync.get(['siliconflowApiKey', 'siliconflowModelId'], async (config) => {
                if (!config.siliconflowApiKey || !config.siliconflowModelId) {
                    port.postMessage({ type: 'AI_STREAM_ERROR', error: 'API Key or Model not set.' });
                    return;
                }

                try {
                    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${config.siliconflowApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: config.siliconflowModelId,
                            messages: msg.messages,
                            stream: true
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    if (response.headers.get('content-type').includes('stream')) {
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n');

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    const data = line.slice(6);
                                    if (data === '[DONE]') break;
                                    try {
                                        const parsed = JSON.parse(data);
                                        port.postMessage({ type: 'AI_CHUNK', chunk: parsed });
                                    } catch (e) { /* Ignore incomplete JSON */ }
                                }
                            }
                        }
                        port.postMessage({ type: 'AI_STREAM_DONE' });

                    } else {
                        // Fallback for non-streaming response
                        const data = await response.json();
                        port.postMessage({ type: 'AI_CHUNK', chunk: data });
                        port.postMessage({ type: 'AI_STREAM_DONE' });
                    }

                } catch (error) {
                    port.postMessage({ type: 'AI_STREAM_ERROR', error: error.message });
                }
            });
        }
    });
});


// Listen for messages from content scripts (for non-streaming requests)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_TAB_ID') {
        if (sender.tab) {
            sendResponse({ tabId: sender.tab.id });
        } else {
            sendResponse({ error: "Sender is not a tab." });
        }
        return true; // Asynchronous response
    }
    
    if (request.type === 'PING') {
        sendResponse({ pong: true });
        return true; // Asynchronous response
    }

    if (request.type === 'CALL_AI') {
        chrome.storage.sync.get(['siliconflowApiKey', 'siliconflowModelId'], (result) => {
            const apiKey = result.siliconflowApiKey;
            const modelId = result.siliconflowModelId || 'Qwen/Qwen2.5-7B-Instruct';

            if (!apiKey) {
                sendResponse({ success: false, error: 'Missing API Key' });
                return;
            }

            fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: request.messages,
                    stream: false
                })
            })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                return response.json();
            })
            .then((data) => {
                const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                if (!content) {
                    sendResponse({ success: false, error: 'Empty response from model' });
                } else {
                    sendResponse({ success: true, content });
                }
            })
            .catch((err) => {
                sendResponse({ success: false, error: err.message });
            });
        });
        return true; // Indicates async response
    }

    if (request.type === 'UPDATE_CONTEXT_MENUS') {
      updateContextMenus();
      sendResponse({ status: 'Context menus updated' });
      return true; // Indicates async response
    }

    return false; // No other sync messages handled here.
});

// This function is injected into the page to prompt the user
function promptForAnnotation(key) {
  const value = prompt(`为 "${key}" 输入注释内容 (留空可用于屏蔽):`);
  // User clicked "Cancel"
  if (value === null) {
    return;
  }
  // User clicked "OK" (even with an empty string)
  chrome.storage.sync.get('annotations', (data) => {
    const annotations = data.annotations || {};
    annotations[key] = value;
    chrome.storage.sync.set({ annotations: annotations }, () => {
      // Notify the content script to update the page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          sendMessageToContentScript(tabs[0].id, { type: 'ANNOTATION_ADDED' });
        }
      });
    });
  });
}

