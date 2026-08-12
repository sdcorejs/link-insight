import '../src/ui/popover.css';

import type { LinkSummaryRequest } from '../src/core/message-contracts';
import { AtlassianLinkProvider } from '../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../src/link-providers/link-provider-registry';
import { HoverController } from '../src/ui/hover-controller';
import { Popover } from '../src/ui/popover';

export default defineContentScript({
  matches: ['https://mail.google.com/chat/*', 'https://chat.google.com/*'],
  allFrames: false,
  runAt: 'document_idle',
  main(context) {
    if (document.body === null) {
      return;
    }

    const controller = new HoverController({
      root: document.body,
      providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
      popover: new Popover(document, window),
      sendMessage: async (request: LinkSummaryRequest) => chrome.runtime.sendMessage(request),
    });
    controller.start();
    context.onInvalidated(() => controller.stop());
  },
});
