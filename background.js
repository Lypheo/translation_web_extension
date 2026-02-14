chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { text, service } = request;

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

