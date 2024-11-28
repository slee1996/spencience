import {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State,
} from "../../core/types.ts";
import {
  elizaLogger,
  generateEnhancedPrompt,
  generateText,
} from "../../index.ts";
import { booleanFooter } from "../../core/parsing.ts";
import { composeContext } from "../../core/context.ts";

export const shouldCreateWebsiteTemplate = `Based on the conversation so far:

{{recentMessages}}

Should {{agentName}} create a website or game for this request?
Respond with YES if one of the following is true:
- The user has explicitly requested a website or game to be created
- The user has provided clear requirements or content for a website or game
- The user is discussing a project or topic that would benefit from a website or game
- Creating a website or game would be valuable and appropriate for the user's needs

Respond with NO if:
- The user hasn't mentioned anything about websites or web content
- The request is better suited for a different format (like a document or image)
- The conversation is not related to content that should be published online
- The user has indicated they don't want a website or game

Consider these factors:
- Is there enough content/context to create a meaningful website or game?
- Would a website or game be the most appropriate format for this content?
- Has the user expressed interest in having an online presence? 
- Would a website or game help achieve the user's goals?

${booleanFooter}`;

