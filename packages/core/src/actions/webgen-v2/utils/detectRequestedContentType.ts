import { generateText } from "../../../index.ts";
import { IAgentRuntime, ModelClass } from "../../../core/types.ts";

export const detectContentType = async (
    runtime: IAgentRuntime,
    prompt: string
): Promise<"game" | "website"> => {
    const response = await generateText({
        runtime,
        context: `Analyze this prompt and determine if it's requesting a game or a website. Only respond with either "GAME" or "WEBSITE".
      
      Prompt: ${prompt}`,
        modelClass: ModelClass.MEDIUM,
    });

    const contentType = response.trim().toUpperCase();
    return contentType === "GAME" ? "game" : "website";
};
