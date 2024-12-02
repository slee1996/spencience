import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText as aiGenerateText } from "ai";
import { IAgentRuntime } from "../../../core/types.ts";
import { composeContext } from "../../../core/context.ts";
import { State, ModelClass, ModelProvider } from "../../../core/types.ts";
import { trimTokens } from "../../../core/generation.ts";
import models from "../../../core/models.ts";

const WEBSITE_PROMPT_TEMPLATE = (originalPrompt: string, character: any) => `
<character>
${Array.isArray(character.bio) ? character.bio.join("\n") : character.bio || ""}
${Array.isArray(character.lore) ? character.lore.join("\n") : character.lore || ""}
${Array.isArray(character.style?.all) ? character.style.all.join("\n") : character.style?.all || ""}
{{recentMemories}}
</character>

<task>As ${character.name}, generate an enhanced prompt for a website based on the following user request:
${originalPrompt}

Your task is to enhance the user's request into a detailed prompt that will generate the best possible website.</task>

<requirements>The enhanced prompt should include the following:
- A detailed description of the website's purpose and content
- A list of the website's pages and a brief description of each page's content
- A list of the website's features and functionality
- A url for the website
- A list of the website's frontend dependencies. DO NOT INCLUDE BACKEND DEPENDENCIES.
- A list of the website pages to be generated and a brief description of each page's content</requirements>

<format>Return the prompt in this format, DO NOT INCLUDE ANY OTHER TEXT:

{
  "description": "<description>",
  "pages": "<pages>",
  "features": "<features>", 
  "url": "<url>",
  "dependencies": "<dependencies>",
  "pageDescriptions": "<pageDescriptions>"
}</format>
`;

export const generateEnhancedWebsitePrompt = async (
    prompt: string,
    runtime: IAgentRuntime,
    state: State
) => {
    let context = composeContext({
        state,
        template: WEBSITE_PROMPT_TEMPLATE(prompt, runtime.character),
    });
    const apiKey = runtime.token;
    const anthropic = createAnthropic({ apiKey });
    const provider = ModelProvider.ANTHROPIC;
    const modelClass = ModelClass.MEDIUM;
    const model = models[provider].model[modelClass];
    const temperature = models[provider].settings.temperature;
    const frequency_penalty = models[provider].settings.frequency_penalty;
    const presence_penalty = models[provider].settings.presence_penalty;
    const max_context_length = models[provider].settings.maxInputTokens;
    const max_response_length = models[provider].settings.maxOutputTokens;

    try {
        context = await trimTokens(context, max_context_length, "gpt-4o");
        console.log("Generating enhanced website prompt...");

        const { text: enhancedPrompt } = await aiGenerateText({
            model: anthropic.languageModel(model),
            prompt: context,
            system: runtime.character.system,
            temperature: temperature,
            maxTokens: max_response_length,
            frequencyPenalty: frequency_penalty,
            presencePenalty: presence_penalty,
        });

        console.log("Received enhanced prompt from Anthropic model.");
        return enhancedPrompt;
    } catch (error) {
        console.error("Error in generateEnhancedPrompt:", error);
        throw error;
    }
};
