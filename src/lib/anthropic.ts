import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

export const anthropic = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;
