function saveOptions() {
  const deeplApiKey = document.getElementById('deepl-api-key').value;
  const openaiApiKey = document.getElementById('openai-api-key').value;
  const openaiApiEndpoint = document.getElementById('openai-api-endpoint').value;
  const openaiApiModel = document.getElementById('openai-api-model').value;

  chrome.storage.sync.set({
    'deepl': deeplApiKey,
    'openai_api_key': openaiApiKey,
    'openai_api_endpoint': openaiApiEndpoint,
    'openai_api_model': openaiApiModel
  }, function() {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restoreOptions() {
  chrome.storage.sync.get(['deepl', 'openai_api_key', 'openai_api_endpoint', 'openai_api_model'], function(items) {
    document.getElementById('deepl-api-key').value = items.deepl || '';
    document.getElementById('openai-api-key').value = items.openai_api_key || '';
    document.getElementById('openai-api-endpoint').value = items.openai_api_endpoint || '';
    document.getElementById('openai-api-model').value = items.openai_api_model || '';
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
