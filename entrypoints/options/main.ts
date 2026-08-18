import './style.css';

import { initializeOptionsPage } from '../../src/options/options-controller';
import { initializeJiraOptions } from '../../src/options/jira-options-controller';
import { RUNTIME_CONFIG } from '../../src/config/runtime-config';
import { SettingsStore } from '../../src/storage/settings-store';

void initializeOptionsPage(document, new SettingsStore(chrome.storage.local));
void initializeJiraOptions(document, (request) => chrome.runtime.sendMessage(request), {
  privacyUrl: `${RUNTIME_CONFIG.worker.origin}/privacy`,
});
