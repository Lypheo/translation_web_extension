chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { text, service } = request;

  if (request.type === 'capture-screenshot') {
    // Capture the visible tab and crop to selection
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        chrome.tabs.sendMessage(sender.tab.id, { 
          type: 'translation-result', 
          service: 'Screenshot', 
          text: 'Error capturing screenshot ' + chrome.runtime.lastError.message 
        });
        return;
      }
      
      // Notify content script that screenshot was captured, so it can show the popup
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'screenshot-captured',
        popupX: request.popupX,
        popupY: request.popupY
      });
      
      // Crop the image and send for translation
      cropAndTranslateImage(dataUrl, request.rect, request.devicePixelRatio, sender.tab.id);
    });
    return true; // Keep message channel open for async response
  }

  if (service === 'DeepL') {
    translateWithDeepL(text).then(translation => {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'translation-result', ...translation });
    });
  } else if (service === 'OpenAI') {
    translateWithOpenAI(text).then(translation => {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'translation-result', ...translation });
    });
  } else {
    // Default to DeepL if no service is specified
    translateWithDeepL(text).then(translation => {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'translation-result', ...translation });
    });
  }
});

async function translateWithDeepL(text) {
  const apiKey = await getApiKey('deepl');
  if (!apiKey) {
    return { service: 'DeepL', text: 'API key not set' };
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'EN' // Or make this configurable
      })
    });

    const data = await response.json();
    return { service: 'DeepL', text: data.translations[0].text };
  } catch (error) {
    return { service: 'DeepL', text: 'Error fetching translation' };
  }
}

async function translateWithOpenAI(text) {
  const { apiKey, apiEndpoint } = await getOpenAiCredentials();

  if (!apiKey || !apiEndpoint) {
    return { service: 'OpenAI', text: 'API key or endpoint not set' };
  }

  const promptTemplate = await getPrompt();
  const prompt = promptTemplate.replaceAll('{{text}}', text);

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: await getModel(),
        reasoning: {
          effort: "none",
          exclude: true,
        },
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    return { service: 'OpenAI', text: data.choices[0].message.content };
  } catch (error) {
    return { service: 'OpenAI', text: 'Error fetching translation' };
  }
}

function getApiKey(service) {
  return new Promise(resolve => {
    chrome.storage.sync.get([service], result => {
      resolve(result[service]);
    });
  });
}

function getPrompt() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['openai_prompt'], result => {
      const defaultPrompt = `Translate the given text into English. If it already is English, translate it into German instead. If the input consists of a single English word, output a short list of German words that best approximate the English meaning.\nOutput nothing but the translated text. Input text: {{text}}`;
      resolve(result.openai_prompt || defaultPrompt);
    });
  });
}

function getOpenAiCredentials() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['openai_api_key', 'openai_api_endpoint'], result => {
      resolve({ apiKey: result.openai_api_key, apiEndpoint: result.openai_api_endpoint });
    });
  });
}


function getModel() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['openai_api_model'], result => {
      resolve(result.openai_api_model);
    });
  });
}

function getImagePrompt() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['openai_image_prompt'], result => {
      const defaultPrompt = `Translate all text, no matter what language, in this image to English. If some text is already in English, keep it as is. If it isn't in English, provide a transcription ahead of the translation.
Present the translation in a well-organized and structured format that makes it easy to understand the correspondence between your response and the original image.
For text formatting, use HTML tags. Your entire response should be valid HTML.
Do not output any needless commentary or summary. Only perform the stated task and nothing else.`;
      resolve(result.openai_image_prompt || defaultPrompt);
    });
  });
}

async function cropAndTranslateImage(dataUrl, rect, devicePixelRatio, tabId) {
  try {
    // Create an offscreen canvas to crop the image
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    
    // Account for device pixel ratio
    const scale = devicePixelRatio || 1;
    const canvas = new OffscreenCanvas(
      Math.round(rect.width * scale), 
      Math.round(rect.height * scale)
    );
    const ctx = canvas.getContext('2d');
    
    // Draw the cropped region
    ctx.drawImage(
      bitmap,
      Math.round(rect.x * scale),
      Math.round(rect.y * scale),
      Math.round(rect.width * scale),
      Math.round(rect.height * scale),
      0,
      0,
      Math.round(rect.width * scale),
      Math.round(rect.height * scale)
    );
    
    // Convert to base64
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const base64 = await blobToBase64(croppedBlob);
    
    // Send to LLM for translation
    const translation = await translateImageWithLLM(base64);
    chrome.tabs.sendMessage(tabId, { type: 'translation-result', ...translation });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, { 
      type: 'translation-result', 
      service: 'Screenshot', 
      text: 'Error processing screenshot: ' + error.message 
    });
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function translateImageWithLLM(base64Image) {
  const { apiKey, apiEndpoint } = await getOpenAiCredentials();

  if (!apiKey || !apiEndpoint) {
    return { service: 'Screenshot', text: 'API key or endpoint not set' };
  }

  const imagePrompt = await getImagePrompt();

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: await getModel(),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: imagePrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    return { service: 'Screenshot', text: data.choices[0].message.content };
  } catch (error) {
    return { service: 'Screenshot', text: 'Error fetching translation: ' + error.message };
  }
}

