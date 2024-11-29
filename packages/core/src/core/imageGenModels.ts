export enum ImageGenModel {
    TogetherAI = "TogetherAI",
    Dalle = "Dalle",
}

export const imageGenModels = {
    [ImageGenModel.TogetherAI]: {
        steps: 10,
        subModel: "black-forest-labs/FLUX.1-dev",
    },
    [ImageGenModel.Dalle]: {
        steps: 0,
        subModel: "dall-e-3",
    },
};

export function getImageGenModel(model: ImageGenModel) {
    return imageGenModels[model];
}
