function saveOptions() {
  const deeplApiKey = document.getElementById('deepl-api-key').value;
  const openaiApiKey = document.getElementById('openai-api-key').value;
  const openaiApiEndpoint = document.getElementById('openai-api-endpoint').value;
  const openaiApiModel = document.getElementById('openai-api-model').value;
  const openaiPrompt = document.getElementById('openai-prompt').value;
  const openaiImagePrompt = document.getElementById('openai-image-prompt').value;

  chrome.storage.sync.set({
    'deepl': deeplApiKey,
    'openai_api_key': openaiApiKey,
    'openai_api_endpoint': openaiApiEndpoint,
    'openai_api_model': openaiApiModel,
    'openai_prompt': openaiPrompt,
    'openai_image_prompt': openaiImagePrompt
  }, function() {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restoreOptions() {
  chrome.storage.sync.get(['deepl', 'openai_api_key', 'openai_api_endpoint', 'openai_api_model', 'openai_prompt', 'openai_image_prompt'], function(items) {
    document.getElementById('deepl-api-key').value = items.deepl || '';
    document.getElementById('openai-api-key').value = items.openai_api_key || '';
    document.getElementById('openai-api-endpoint').value = items.openai_api_endpoint || '';
    document.getElementById('openai-api-model').value = items.openai_api_model || '';
    document.getElementById('openai-prompt').value = items.openai_prompt || '';
    document.getElementById('openai-image-prompt').value = items.openai_image_prompt || '';
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
