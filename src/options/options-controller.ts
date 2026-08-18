interface OptionsSettingsStore {
  hasApiKey(): Promise<boolean>;
  saveApiKey(value: string): Promise<void>;
  clearApiKey(): Promise<void>;
}

interface OptionsElements {
  readonly form: HTMLFormElement;
  readonly input: HTMLInputElement;
  readonly clearButton: HTMLButtonElement;
  readonly status: HTMLParagraphElement;
}

export async function initializeOptionsPage(
  document: Document,
  store: OptionsSettingsStore,
): Promise<void> {
  const elements = readElements(document);

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveKey(elements, store);
  });
  elements.clearButton.addEventListener('click', () => {
    void clearKey(elements, store);
  });

  try {
    const hasSavedKey = await store.hasApiKey();
    setSavedState(elements, hasSavedKey);
    if (hasSavedKey) {
      setStatus(elements.status, 'A Gemini API key is saved locally on this device.', 'info');
    }
  } catch {
    setStatus(elements.status, 'Could not load saved-key status. Reload this page.', 'error');
  }
}

async function saveKey(elements: OptionsElements, store: OptionsSettingsStore): Promise<void> {
  const enteredValue = elements.input.value;
  try {
    await store.saveApiKey(enteredValue);
    elements.input.value = '';
    setSavedState(elements, true);
    setStatus(elements.status, 'Saved locally on this device.', 'success');
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'Enter a Gemini API key before saving.'
        ? error.message
        : 'Could not save the key. Try again.';
    setStatus(elements.status, message, 'error');
  }
}

async function clearKey(elements: OptionsElements, store: OptionsSettingsStore): Promise<void> {
  try {
    await store.clearApiKey();
    elements.input.value = '';
    setSavedState(elements, false);
    setStatus(elements.status, 'Key cleared from this device.', 'success');
  } catch {
    setStatus(elements.status, 'Could not clear the key. Try again.', 'error');
  }
}

function setSavedState(elements: OptionsElements, hasSavedKey: boolean): void {
  elements.input.placeholder = hasSavedKey
    ? 'A key is currently saved'
    : 'Enter your Gemini API key';
  elements.clearButton.disabled = !hasSavedKey;
}

function setStatus(
  status: HTMLParagraphElement,
  message: string,
  state: 'info' | 'success' | 'error',
): void {
  status.textContent = message;
  status.dataset.state = state;
}

function readElements(document: Document): OptionsElements {
  const form = document.querySelector('#api-key-form');
  const input = document.querySelector('#gemini-api-key');
  const clearButton = document.querySelector('#clear-key');
  const status = document.querySelector('#save-status');

  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !(clearButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLParagraphElement)
  ) {
    throw new Error('Options page markup is incomplete.');
  }

  return { form, input, clearButton, status };
}
