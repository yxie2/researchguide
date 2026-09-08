import { WorkflowError } from './workflow.mjs';

export function normalizeSettings(input = {}, previous) {
  const provider = input.provider || 'demo';
  if (!['demo', 'ollama', 'openai-compatible'].includes(provider))
    throw new WorkflowError('Choose Demo, Ollama, or an OpenAI-compatible API.');
  const string = (value, name, max) => {
    if (typeof value !== 'string' || value.length > max)
      throw new WorkflowError(`${name} is invalid or too long.`);
    return value.trim();
  };
  const model = string(input.model ?? '', 'Model name', 200);
  const maxOutputTokens = Number(input.maxOutputTokens ?? 4096);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 128 || maxOutputTokens > 16384)
    throw new WorkflowError('Output token limit must be an integer between 128 and 16384.');
  const tokenParameter = input.tokenParameter || 'max_completion_tokens';
  if (!['max_tokens', 'max_completion_tokens'].includes(tokenParameter))
    throw new WorkflowError('Select a supported output token parameter.');
  let baseUrl = string(
    input.baseUrl ??
      (provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'),
    'Base URL',
    2000,
  );
  let apiKey = string(input.apiKey ?? '', 'API key', 4096);
  if (/[\r\n]/.test(apiKey)) throw new WorkflowError('API keys must be a single line.');
  if (provider === 'demo')
    return { provider, model: '', baseUrl: '', apiKey: '', maxOutputTokens, tokenParameter };
  if (!model)
    throw new WorkflowError(
      'Enter the model name supplied by your provider or installed in Ollama.',
    );
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new WorkflowError('Enter a complete API base URL.');
  }
  if (url.username || url.password || url.search || url.hash)
    throw new WorkflowError(
      'Base URLs must not contain credentials, query parameters, or fragments.',
    );
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw new WorkflowError('Use HTTPS for remote providers. HTTP is allowed only for localhost.');
  baseUrl = url.href.replace(/\/+$/, '');
  if (baseUrl.endsWith(provider === 'ollama' ? '/api/chat' : '/chat/completions'))
    throw new WorkflowError('Enter the API base URL, without the chat endpoint suffix.');
  // Never forward an existing credential to a different endpoint or provider.
  if (
    !apiKey &&
    input.clearApiKey !== true &&
    previous?.provider === provider &&
    previous?.baseUrl === baseUrl
  )
    apiKey = previous.apiKey;
  if (input.clearApiKey === true) apiKey = '';
  return { provider, model, baseUrl, apiKey, maxOutputTokens, tokenParameter };
}

export function settingsFromEnv(env = {}) {
  const provider = env.LLM_PROVIDER || (env.OLLAMA_MODEL ? 'ollama' : 'demo');
  return normalizeSettings({
    provider,
    model: env.LLM_MODEL || env.OLLAMA_MODEL || '',
    baseUrl:
      env.LLM_BASE_URL ||
      (provider === 'ollama'
        ? env.OLLAMA_URL || 'http://127.0.0.1:11434'
        : 'https://api.openai.com/v1'),
    apiKey: env.LLM_API_KEY || '',
    maxOutputTokens: env.LLM_MAX_OUTPUT_TOKENS || 4096,
    tokenParameter: env.LLM_TOKEN_PARAMETER || 'max_completion_tokens',
  });
}

export function publicSettings(settings, revision) {
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    hasApiKey: Boolean(settings.apiKey),
    maxOutputTokens: settings.maxOutputTokens,
    tokenParameter: settings.tokenParameter,
    revision,
  };
}

export async function callModel(system, content, config) {
  // Preserve the original programmatic Ollama adapter shape for existing callers.
  const provider = config.provider || (config.model ? 'ollama' : 'demo');
  if (provider === 'demo')
    throw new WorkflowError('Select a model provider before testing a connection.');
  const baseUrl = config.baseUrl || config.url;
  const ollama = provider === 'ollama';
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content },
  ];
  const body = ollama
    ? {
        model: config.model,
        stream: false,
        messages,
        options: { temperature: 0.2, num_predict: config.maxOutputTokens || 1200 },
      }
    : {
        model: config.model,
        stream: false,
        messages,
        [config.tokenParameter || 'max_completion_tokens']: config.maxOutputTokens || 4096,
      };
  let response;
  try {
    response = await fetch(
      `${baseUrl.replace(/\/$/, '')}${ollama ? '/api/chat' : '/chat/completions'}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(90000),
      },
    );
  } catch {
    throw new WorkflowError(
      'The model could not be reached within 90 seconds. Check the base URL, connection, and model service. Redirects are not followed.',
      502,
    );
  }
  if (!response.ok) {
    const hint =
      response.status === 401 || response.status === 403
        ? 'Check your API key and account permissions.'
        : response.status === 429
          ? 'Your provider reported a rate or quota limit. Check your usage and try later.'
          : response.status === 400
            ? 'Check the model name and output token parameter in LLM settings.'
            : 'Check the base URL, model name, and provider service.';
    // Provider error bodies may echo credentials or submitted data; never forward them.
    throw new WorkflowError(`Model provider returned HTTP ${response.status}. ${hint}`, 502);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new WorkflowError(
      'The model provider returned invalid JSON. Check that this endpoint uses the selected API format.',
      502,
    );
  }
  if (
    (!ollama && data.choices?.[0]?.finish_reason === 'length') ||
    (ollama && data.done_reason === 'length')
  )
    throw new WorkflowError(
      'The model reached its output limit before completing guidance. Increase the token limit in LLM settings.',
      502,
    );
  const output = ollama ? data.message?.content : data.choices?.[0]?.message?.content;
  if (typeof output !== 'string' || !output.trim())
    throw new WorkflowError(
      'The model returned no text guidance. Check model compatibility or increase the output token limit.',
      502,
    );
  return output.slice(0, 16000);
}
