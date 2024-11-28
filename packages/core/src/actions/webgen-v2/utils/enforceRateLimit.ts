import { elizaLogger } from "../../..";

export const enforceRateLimit = async ({
    lastGenerationTime,
    minDelayBetweenGenerations,
}: {
    lastGenerationTime: number;
    minDelayBetweenGenerations: number;
}) => {
    const now = Date.now();
    const timeSinceLastGeneration = now - lastGenerationTime;
    if (timeSinceLastGeneration < minDelayBetweenGenerations) {
        const delayNeeded =
            minDelayBetweenGenerations - timeSinceLastGeneration;
        elizaLogger.log(`Rate limit enforced - waiting ${delayNeeded}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayNeeded));
    }
    lastGenerationTime = Date.now();
    elizaLogger.log("Rate limit check completed");
};
