/* A robust function to render content with LaTeX and styled English text */
function renderContent(text) {
  try {
    // Split the text by LaTeX delimiters ($...$ or $$...$$), keeping the delimiters
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

    const renderedParts = parts.map((part, index) => {
      // Odd-indexed parts are the LaTeX expressions
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
          // If a specific LaTeX part fails, just return it as text (escaped)
          console.error("KaTeX rendering error for part:", part, error);
          const escaper = document.createElement('div');
          escaper.textContent = part;
          return escaper.innerHTML;
        }
      } else {
        // Even-indexed parts are plain text. Style English words here.
        // First, escape any potential HTML in the user's text
        const escaper = document.createElement('div');
        escaper.textContent = part;
        const safePart = escaper.innerHTML;
        
        return safePart.replace(/\b([a-zA-Z]{2,})\b/g, (match) => {
            return `<span class="math-font">${match}</span>`;
        });
      }
    });

    return renderedParts.join('');
  } catch (error) {
    // This is a fallback for unexpected errors in the splitting/mapping logic itself
    console.error("General content rendering error:", error);
    const escaper = document.createElement('div');
    escaper.textContent = text;
    return escaper.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const annotationsList = document.getElementById('annotationsList');
  const addAnnotationForm = document.getElementById('addAnnotationForm');

  function loadAnnotations() {
    chrome.storage.sync.get('annotations', (data) => {
      const annotations = data.annotations || {};
      annotationsList.innerHTML = '';
      for (const key in annotations) {
        const item = document.createElement('div');
        item.className = 'annotation-item';
        
        const renderedValue = renderContent(annotations[key]);

        item.innerHTML = `
          <div class="annotation-card-header">
            <span class="annotation-card-title">${key}</span>
            <button class="delete-btn" data-key="${key}">&times;</button>
          </div>
          <div class="annotation-card-body">
            ${renderedValue}
          </div>
        `;
        annotationsList.appendChild(item);
      }
    });
  }

  addAnnotationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('key').value;
    const value = document.getElementById('value').value;
    // Allow saving empty annotations for masking purposes
    if (key) {
      chrome.storage.sync.get('annotations', (data) => {
        const annotations = data.annotations || {};
        annotations[key] = value;
        chrome.storage.sync.set({ annotations }, () => {
          loadAnnotations();
          addAnnotationForm.reset();
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'ANNOTATION_ADDED' });
            }
          });
        });
      });
    }
  });

  annotationsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const key = e.target.dataset.key;
      chrome.storage.sync.get('annotations', (data) => {
        const annotations = data.annotations || {};
        delete annotations[key];
        chrome.storage.sync.set({ annotations }, () => {
          loadAnnotations();
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'ANNOTATION_ADDED' });
            }
          });
        });
      });
    }
  });

  loadAnnotations();
});

document.getElementById('open-settings-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
