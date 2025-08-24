const contextMenuConfig = {
    addAnnotation: { id: 'toggle-add-annotation', key: 'contextMenu_addAnnotation' },
    search: { id: 'toggle-search', key: 'contextMenu_search' },
    askAI: { id: 'toggle-ask-ai', key: 'contextMenu_askAI' },
    rewrite: { id: 'toggle-rewrite', key: 'contextMenu_rewrite' },
};

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const modelIdInput = document.getElementById('model-id');
    const saveButton = document.getElementById('save');
    const statusSpan = document.getElementById('status');

    // Load saved settings
    function loadSettings() {
        chrome.storage.sync.get(['siliconflowApiKey', 'siliconflowModelId'], (result) => {
            const apiKeyEl = document.getElementById('api-key');
            const modelIdEl = document.getElementById('model-id');

            if (apiKeyEl && result.siliconflowApiKey) {
                apiKeyEl.value = result.siliconflowApiKey;
            }

            if (modelIdEl) {
                // Set the default model if none is saved
                modelIdEl.value = result.siliconflowModelId || 'Qwen/Qwen2.5-7B-Instruct';
            }
        });
    }

    // Save new settings
    function saveSettings() {
        const apiKey = (apiKeyInput && apiKeyInput.value) || '';
        const modelId = (modelIdInput && modelIdInput.value) || '';

        if (!apiKey || !modelId) {
            statusSpan.textContent = 'API Key 和模型不能为空！';
            statusSpan.style.color = 'red';
            setTimeout(() => { statusSpan.textContent = ''; }, 3000);
            return;
        }

        chrome.storage.sync.set({
            siliconflowApiKey: apiKey,
            siliconflowModelId: modelId
        }, () => {
            statusSpan.textContent = '保存成功！';
            statusSpan.style.color = 'green';
            setTimeout(() => { statusSpan.textContent = ''; }, 2000);
        });
    }

    saveButton.addEventListener('click', saveSettings);
    loadSettings();

    // Load context menu settings
    const menuKeys = Object.values(contextMenuConfig).map(item => item.key);
    chrome.storage.sync.get(menuKeys, (result) => {
        for (const config of Object.values(contextMenuConfig)) {
            const el = document.getElementById(config.id);
            if (el) {
                // Default to true if the setting is not stored yet
                el.checked = result[config.key] !== false;
            }
        }
    });

    // Add change listeners for context menu toggles
    for (const config of Object.values(contextMenuConfig)) {
        const el = document.getElementById(config.id);
        if (el) {
            el.addEventListener('change', (event) => {
                const settingToSave = { [config.key]: event.target.checked };
                chrome.storage.sync.set(settingToSave, () => {
                    // Notify background script to update context menus
                    chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
                        } else {
                            console.log('Context menu update requested.');
                        }
                    });
                    
                    const status = document.getElementById('status');
                    status.textContent = '右键菜单设置已更新。';
                    setTimeout(() => {
                        status.textContent = '';
                    }, 1500);
                });
            });
        }
    }
});



