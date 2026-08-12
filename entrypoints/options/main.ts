import './style.css';

import { initializeOptionsPage } from '../../src/options/options-controller';
import { SettingsStore } from '../../src/storage/settings-store';

void initializeOptionsPage(document, new SettingsStore(chrome.storage.local));
