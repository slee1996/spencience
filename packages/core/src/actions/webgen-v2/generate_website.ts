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
import {
    elizaLogger,
    generateText,
} from "../../index.ts";
import { shouldCreateWebsiteTemplate } from "./templates.ts";
import { detectContentType } from "./utils/detectRequestedContentType.ts";

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

        // Use the template to determine if we should create a website
        try {
            const context = composeContext({
                state,
                template: shouldCreateWebsiteTemplate,
            });
            console.log("Composed context:", context);

            const shouldCreateResponse = await generateText({
                runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });
            console.log("Should create response:", shouldCreateResponse);

            const shouldCreate = shouldCreateResponse
                .trim()
                .toUpperCase()
                .includes("YES");
            elizaLogger.log(`Should create website? ${shouldCreate}`);

            return shouldCreate;
        } catch (error) {
            elizaLogger.error("Error in website validation:", error);
            return false;
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ): Promise<Content | void> => {
        try {
            state = (await runtime.composeState(message)) as State;
            const userId = runtime.agentId;
            elizaLogger.log("User ID:", userId);

            const websitePrompt = message.content.text;
            elizaLogger.log("Website prompt received:", websitePrompt);
            // Add a short delay to allow for rate limiting and processing
            await new Promise((resolve) => setTimeout(resolve, 1000));

            elizaLogger.log("Starting website generation process");

            // Create a promise that rejects after timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(
                        new Error(
                            "Website generation timed out after 5 minutes"
                        )
                    );
                }, DEPLOYMENT_TIMEOUT);
            });

            // Create the main generation handling promise
            const generationPromise = (async () => {
                const contentType = await detectContentType(
                    runtime,
                    websitePrompt
                );

                // Generate HTML content
                const homeContent = await generateHtmlContent(
                    contentType,
                    runtime,
                    state,
                    websitePrompt
                );

                const sanitizedHomeContent = homeContent
                    // eslint-disable-next-line no-control-regex
                    .replace(/[^\u0009\u000A\u000D\x20-\x7E\xA0-\uFFFF]/g, "")
                    .replace(/[\u2028\u2029]/g, "\n");

                const pages = { home: sanitizedHomeContent };

                await createHtmlFiles(pages);

                const token = runtime.getSetting("GITHUB_TOKEN");
                const username = runtime.getSetting("GITHUB_USERNAME");

                if (!token || !username) {
                    throw new Error("GitHub credentials not found");
                }

                const repoName = `generated-website-${Date.now()}`;

                const deployingResponse: Content = {
                    text: "Website is being deployed to GitHub Pages. This will take a few minutes...",
                    action: "CREATE_WEBSITE",
                    source: message.content.source,
                };
                await callback(deployingResponse, []);

                const siteUrl = await deployToGithub({
                    repoName,
                    githubToken: token,
                    username,
                });

                await new Promise((resolve) =>
                    setTimeout(resolve, 2 * 60 * 1000)
                );

                return siteUrl;
            })();

            // Race between timeout and generation handling
            const siteUrl = await Promise.race([
                generationPromise,
                timeoutPromise,
            ]);

            const response: Content = {
                text: `I've created and deployed a website based on our conversation. You can view it at: ${siteUrl}`,
                action: "CREATE_WEBSITE",
                source: message.content.source,
            };

            await callback(response, []);
            return response;
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
