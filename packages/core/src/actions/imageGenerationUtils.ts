import { Buffer } from "buffer";
import Together from "together-ai";
import { IAgentRuntime } from "../core/types.ts";
import { getImageGenModel, ImageGenModel } from "../core/imageGenModels.ts";
import OpenAI from "openai";
import { elizaLogger } from "../index";
import { generateText } from "../core/generation.ts";
import { ModelClass } from "../core/types.ts";
import Replicate from "replicate";

export const imagePromptTemplate = `# Task: Enhance the image generation prompt
Your task is to enhance the user's request into a detailed prompt that will generate the best possible image.

# Instructions
- Focus on artistic style, mood, lighting, composition and important details
- Keep the final prompt under 200 characters
- If the request is to "generate anything", you have creative control
- Only respond with the enhanced prompt text, no other commentary

Original request: {{prompt}}

Enhanced prompt:`;

export const enhancePrompt = async (
    originalPrompt: string,
    runtime: IAgentRuntime
): Promise<string> => {
    if (!runtime.llamaService) {
        elizaLogger.log("No llamaService available, using original prompt");
        return originalPrompt;
    }

    try {
        const context = `# Task: Enhance the image generation prompt
Your task is to enhance the user's request into a detailed prompt that will generate the best possible image.

# Instructions
- Focus on artistic style, mood, lighting, composition and important details
- Keep the final prompt under 200 characters
- If the request is to "generate anything", you have creative control
- Only respond with the enhanced prompt text, no other commentary

Original request: ${originalPrompt}

Enhanced prompt:`;

        elizaLogger.log("Sending context to llama:", context);

        const promptResponse = await generateText({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        if (promptResponse?.trim()) {
            elizaLogger.log("Successfully enhanced prompt to:", promptResponse);
            return promptResponse.trim();
        }
    } catch (error) {
        elizaLogger.error("Prompt enhancement failed:", error);
    }

    elizaLogger.log("Using original prompt due to enhancement failure");
    return originalPrompt;
};

export const generateImage = async (
    data: {
        prompt: string;
        width: number;
        height: number;
        count?: number;
    },
    runtime: IAgentRuntime
): Promise<{
    success: boolean;
    data?: string[];
    error?: any;
}> => {
    try {
        // Enhance the prompt first
        const enhancedPrompt = await enhancePrompt(data.prompt, runtime);
        elizaLogger.log(
            "Using enhanced prompt for generation:",
            enhancedPrompt
        );

        // Rest of the existing generateImage code, but use enhancedPrompt instead of data.prompt
        const imageGenModel = runtime.imageGenModel;
        const model = getImageGenModel(imageGenModel);
        const apiKey = runtime.getSetting("REPLICATE_API_TOKEN");
        // imageGenModel === ImageGenModel.TogetherAI
        //     ? runtime.getSetting("TOGETHER_API_KEY")
        //     : runtime.getSetting("OPENAI_API_KEY");

        let { count } = data;
        if (!count) {
            count = 1;
        }
        if (apiKey === runtime.getSetting("REPLICATE_API_TOKEN")) {
            const input = {
                prompt: enhancedPrompt,
                width: data.width,
                height: data.height,
                prompt_upsampling: false,
                safety_checker: false,
                safety_tolerance: 2,
            };
            const replicate = new Replicate({
                auth: apiKey,
            });

            const response = await replicate.run(
                "black-forest-labs/flux-1.1-pro",
                {
                    input,
                }
            );

            // Handle ReadableStream response
            if (response instanceof ReadableStream) {
                const reader = response.getReader();
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }

                const concatenated = new Uint8Array(
                    chunks.reduce((acc, chunk) => acc + chunk.length, 0)
                );
                let offset = 0;
                for (const chunk of chunks) {
                    concatenated.set(chunk, offset);
                    offset += chunk.length;
                }

                const base64 =
                    "data:image/jpeg;base64," +
                    Buffer.from(concatenated).toString("base64");
                return { success: true, data: [base64] };
            }

            // Handle array of URLs response
            if (Array.isArray(response)) {
                const urls = response.map((r) => r.url).filter(Boolean);
                if (urls.length === 0) {
                    throw new Error("No valid image URLs in response");
                }

                const base64s = await Promise.all(
                    urls.map(async (url) => {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(
                                `Failed to fetch image: ${response.statusText}`
                            );
                        }
                        const blob = await response.blob();
                        const buffer = await blob.arrayBuffer();
                        let base64 = Buffer.from(buffer).toString("base64");
                        base64 = "data:image/jpeg;base64," + base64;
                        return base64;
                    })
                );
                return { success: true, data: base64s };
            }

            throw new Error("Unexpected response format from Replicate API");
        } else if (imageGenModel === ImageGenModel.TogetherAI) {
            console.log("ApiKey:", apiKey);
            const together = new Together({ apiKey });
            const response = await together.images.create({
                model: "black-forest-labs/FLUX.1-dev",
                prompt: enhancedPrompt,
                width: data.width,
                height: data.height,
                steps: model.steps,
                n: count,
            });
            const urls: string[] = [];
            for (let i = 0; i < response.data.length; i++) {
                //@ts-ignore
                const url = response.data[i].url;
                urls.push(url);
            }
            const base64s = await Promise.all(
                urls.map(async (url) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();
                    let base64 = Buffer.from(buffer).toString("base64");
                    base64 = "data:image/jpeg;base64," + base64;
                    return base64;
                })
            );
            return { success: true, data: base64s };
        } else {
            let targetSize = `${data.width}x${data.height}`;
            if (
                targetSize !== "1024x1024" &&
                targetSize !== "1792x1024" &&
                targetSize !== "1024x1792"
            ) {
                targetSize = "1024x1024";
            }
            const openai = new OpenAI({ apiKey });
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: enhancedPrompt,
                size: targetSize as "1024x1024" | "1792x1024" | "1024x1792",
                n: count,
                response_format: "b64_json",
            });
            const base64s = response.data.map(
                (image) => `data:image/png;base64,${image.b64_json}`
            );
            return { success: true, data: base64s };
        }
    } catch (error) {
        elizaLogger.error("Image generation failed:", error);
        return { success: false, error: error };
    }
};

export const generateCaption = async (
    data: { imageUrl: string },
    runtime: IAgentRuntime
): Promise<{
    title: string;
    description: string;
}> => {
    const { imageUrl } = data;
    const resp = await runtime.imageDescriptionService.describeImage(imageUrl);
    return {
        title: resp.title.trim(),
        description: resp.description.trim(),
    };
};
