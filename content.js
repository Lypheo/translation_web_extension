let buttonVisible = false;
let popupVisible = false;

document.addEventListener('mouseup', function(e) {
  if (popupVisible) {
    return;
  }
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0 && !buttonVisible) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showButton(rect.left + rect.width / 2 + window.scrollX, rect.top + window.scrollY - 70, selectedText);
  }
});

function showButton(x, y, selectedText) {
  buttonVisible = true;
  const button = document.createElement('button');
  button.innerHTML = 'TL';
  button.id = 'translate-button';
  button.style.position = 'absolute';
  button.style.top = `${y}px`;
  button.style.left = `${x}px`;
  button.style.transform = 'translateX(-50%)';
  button.style.zIndex = 10000;

  // Prevent button click from clearing selection
  button.addEventListener('mousedown', (e) => e.preventDefault());

  button.addEventListener('click', function(e) {
    e.stopPropagation();
    // Show the popup immediately with loading indicators
    showPopup(x, y - 30, selectedText);
    // Send the text to the background script for translation
    chrome.runtime.sendMessage({ text: selectedText, service: 'DeepL' });
    hideButton();
  });

  document.body.appendChild(button);

  document.addEventListener('mousedown', function hideButtonOnClick(e) {
    if (e.target.id !== 'translate-button') {
      hideButton();
      document.removeEventListener('mousedown', hideButtonOnClick);
    }
  });
}

function hideButton() {
  const button = document.getElementById('translate-button');
  if (button) {
    button.remove();
  }
  buttonVisible = false;
}

function ensurePopupInView(popup) {
  const rect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = parseInt(popup.style.left, 10);
  let top = parseInt(popup.style.top, 10);

  if (rect.right > viewportWidth) {
    left = viewportWidth - rect.width;
  }

  if (rect.bottom > viewportHeight) {
    top = viewportHeight - rect.height;
  }

  if (rect.left < 0) {
    left = 0;
  }

  if (rect.top < 0) {
    top = 0;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function showPopup(x, y, selectedText) {
  popupVisible = true;
  const popup = document.createElement('div');
  popup.id = 'translation-popup';
  popup.style.position = 'absolute';
  popup.style.top = `${y}px`;
  popup.style.left = `${x}px`;
  popup.style.zIndex = 10001;
  popup.style.background = 'white';
  popup.style.color = 'black';
  popup.style.border = '1px solid black';
  popup.style.padding = '10px';

  // DeepL pane with loading indicator
  const deepLPane = document.createElement('div');
  deepLPane.id = 'translation-pane-DeepL';
  deepLPane.style.borderBottom = '1px solid #eee';
  deepLPane.style.marginBottom = '10px';
  deepLPane.style.paddingBottom = '10px';

  const deepLHeader = document.createElement('div');
  deepLHeader.style.fontWeight = 'bold';
  deepLHeader.style.fontSize = '1.1em';
  deepLHeader.textContent = 'DeepL';

  const deepLContent = document.createElement('div');
  deepLContent.id = 'translation-content-DeepL';
  deepLContent.innerHTML = `<span class="loading"> </span>`;

  deepLPane.appendChild(deepLHeader);
  deepLPane.appendChild(deepLContent);
  popup.appendChild(deepLPane);

  // OpenAI pane with a button
  const openAIPane = document.createElement('div');
  openAIPane.id = 'translation-pane-OpenAI';

  const openAIHeader = document.createElement('div');
  openAIHeader.style.fontWeight = 'bold';
  openAIHeader.style.fontSize = '1.1em';
  openAIHeader.textContent = 'OpenAI';

  const openAIContent = document.createElement('div');
  openAIContent.id = 'translation-content-OpenAI';
  const translateButton = document.createElement('button');
  translateButton.textContent = 'Translate';
  translateButton.style.marginTop = '5px';
  translateButton.style.cursor = 'pointer';
  
  translateButton.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ text: selectedText, service: 'OpenAI' });
    openAIContent.innerHTML = `<span class="loading"> </span>`;
  });

  openAIContent.appendChild(translateButton);
  openAIPane.appendChild(openAIHeader);
  openAIPane.appendChild(openAIContent);
  popup.appendChild(openAIPane);

  document.body.appendChild(popup);
  ensurePopupInView(popup);

  document.addEventListener('mousedown', function hidePopupOnClick(e) {
    if (!popup.contains(e.target)) {
      hidePopup();
      document.removeEventListener('mousedown', hidePopupOnClick);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translation-result') {
    const content = document.getElementById(`translation-content-${request.service}`);
    if (content) {
      content.textContent = request.text;
    }
    const popup = document.getElementById(`translation-popup`);
    ensurePopupInView(popup);
  }
});

function hidePopup() {
  const popup = document.getElementById('translation-popup');
  if (popup) {
    popup.remove();
  }
  popupVisible = false;
}
