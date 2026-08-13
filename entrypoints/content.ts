import '../src/ui/popover.css';
import '../src/ui/jira-action-card.css';

import type { JiraRuntimeRequest, LinkSummaryRequest } from '../src/core/message-contracts';
import { AtlassianLinkProvider } from '../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../src/link-providers/link-provider-registry';
import { HoverController } from '../src/ui/hover-controller';
import { JiraActionCard } from '../src/ui/jira-action-card';
import { JiraActionController } from '../src/ui/jira-action-controller';
import { Popover } from '../src/ui/popover';

export default defineContentScript({
  matches: ['https://mail.google.com/chat/*', 'https://chat.google.com/*'],
  allFrames: false,
  runAt: 'document_idle',
  main(context) {
    if (document.body === null) {
      return;
    }

    const jiraCard = new JiraActionCard(document);
    const jiraActions = new JiraActionController(
      document,
      window,
      jiraCard,
      async (request: JiraRuntimeRequest) => chrome.runtime.sendMessage(request),
    );
    const controller = new HoverController({
      root: document.body,
      providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
      popover: new Popover(document, window),
      sendMessage: async (request: LinkSummaryRequest) => chrome.runtime.sendMessage(request),
      jiraActions,
    });
    controller.start();
    context.onInvalidated(() => controller.stop());
  },
});
