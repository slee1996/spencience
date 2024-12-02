import { composeContext } from "../../core/context.ts";
import {
    Action,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "../../core/types.ts";
import { elizaLogger, generateText } from "../../index.ts";
import { shouldCreateWebsiteTemplate } from "./templates.ts";
import { detectContentType } from "./utils/detectRequestedContentType.ts";
import { generateEnhancedWebsitePrompt } from "./utils/generateEnhancedPrompt.ts";

const DEPLOYMENT_TIMEOUT = 5 * 60 * 1000;

export const WEBSITE_GENERATION: Action = {
    name: "GENERATE_WEBSITE",
    similes: [
        "PUBLISH_WEBSITE",
        "UPDATE_WEBSITE",
        "DEPLOY_WEBSITE",
        "GENERATE_WEBSITE",
        "BUILD_WEBSITE",
        "MAKE_WEBSITE",
        "SETUP_WEBSITE",
    ],
    description: "Generate and publish website to GitHub Pages",
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        elizaLogger.log("Validating CREATE_WEBSITE action");

        // First check environment variables
        const hasEnvVars = !!(
            process.env.OPENAI_API_KEY &&
            process.env.GITHUB_TOKEN &&
            process.env.GITHUB_USERNAME
        );

        if (!hasEnvVars) {
            elizaLogger.log("Missing required environment variables");
            return false;
        }

        // Update state with recent messages
        state = await runtime.updateRecentMessageState(state);

        // Simple keyword detection for website creation intent
        const messageText = message.content.text.toLowerCase();
        const websiteKeywords = [
            "website",
            "webpage",
            "web page",
            "site",
            "landing page",
        ];

        const hasWebsiteKeyword = websiteKeywords.some((keyword) =>
            messageText.includes(keyword)
        );

        const actionKeywords = [
            "create",
            "make",
            "build",
            "generate",
            "setup",
            "deploy",
        ];

        const hasActionKeyword = actionKeywords.some((keyword) =>
            messageText.includes(keyword)
        );

        const shouldCreate = hasWebsiteKeyword && hasActionKeyword;
        elizaLogger.log(`Should create website? ${shouldCreate}`);

        return shouldCreate;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ): Promise<Content | void> => {
        // LOOP
        /*
            - generate enhanced prompt
            - generate initial website
            -- detect and apply continuation if needed
            - scan html for links
            - generate pages for each link
            -- detect and apply continuation if needed
            - validate html
            -- apply fixes if needed
            - deploy to github
        */
        try {
            state = (await runtime.composeState(message)) as State;
            const userId = runtime.agentId;
            elizaLogger.log("User ID:", userId);

            const websitePrompt = message.content.text;
            const enhancedWebsitePrompt = await generateEnhancedWebsitePrompt(
                websitePrompt,
                runtime,
                state
            );
            elizaLogger.log("Website prompt received:", enhancedWebsitePrompt);
            // {
            //     "description": "A modern, playful website dedicated to celebrating dogs through interactive features and community engagement. The site will showcase different breeds, offer training tips, and connect dog lovers worldwide.",
            //     "pages": "home, breeds, training, community, health, adoption, gallery",
            //     "features": "breed comparison tool, training progress tracker, community photo sharing, health symptom checker, adoption listings feed, interactive dog breed quiz, real-time chat for dog owners",
            //     "url": "goodestboys.spencience.com",
            //     "dependencies": "React, TailwindCSS, Framer Motion, React Router, React Query, DaisyUI, Three.js for interactive 3D dog models, Socket.io-client for chat",
            //     "pageDescriptions": {
            //       "home": "Landing page with featured breeds, latest community posts, and quick access to tools",
            //       "breeds": "Comprehensive database of dog breeds with interactive 3D models and comparison tools",
            //       "training": "Interactive training guides with progress tracking and video tutorials",
            //       "community": "Social space for dog owners with photo sharing and real-time chat",
            //       "health": "Veterinary resources and symptom checker with emergency contact info",
            //       "adoption": "Real-time feed of available dogs from local shelters with filtering options",
            //       "gallery": "User-submitted photos with voting system and featured weekly selections"
            //     }
            //   }
            // Add a short delay to allow for rate limiting and processing
            return;
        } catch (error) {
            elizaLogger.error("Website creation failed:", error);
            const errorResponse: Content = {
                text: `Sorry, I encountered an error while creating the website: ${error.message}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            await callback(errorResponse, []);
            return errorResponse;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please create a website about our project",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll generate and publish the website to GitHub Pages",
                    action: "CREATE_WEBSITE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "right?? go ahead and use threejs to make it, it should be an isometric view and the car should be controlled with the arrow keys",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll generate and publish the website to GitHub Pages",
                    action: "CREATE_WEBSITE",
                },
            },
        ],
    ],
};
