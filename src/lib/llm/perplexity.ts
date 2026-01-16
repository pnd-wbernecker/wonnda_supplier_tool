// Perplexity API client using OpenAI-compatible API

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function callPerplexity(
  messages: PerplexityMessage[],
  model: string = "sonar"
): Promise<string> {
  const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${error}`);
  }

  const data: PerplexityResponse = await response.json();
  return data.choices[0].message.content;
}

export async function researchCompanyAddress(
  companyName: string,
  domain: string,
  country: string,
  promptTemplate: string
): Promise<string> {
  const prompt = promptTemplate
    .replace("{company_name}", companyName)
    .replace("{domain}", domain)
    .replace("{country}", country);

  const response = await callPerplexity([
    {
      role: "system",
      content: `You are a research assistant. Search the web for company information. 
Only use information from the specified domain. 
If you cannot find the requested information, respond with an empty string.
Do not make up or hallucinate any information.`,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  // Clean up response - if it contains phrases like "I couldn't find", return empty
  const lowerResponse = response.toLowerCase();
  if (
    lowerResponse.includes("couldn't find") ||
    lowerResponse.includes("could not find") ||
    lowerResponse.includes("unable to find") ||
    lowerResponse.includes("no address") ||
    lowerResponse.includes("not available")
  ) {
    return "";
  }

  return response.trim();
}

export async function researchCompanyDescription(
  companyName: string,
  domain: string,
  promptTemplate: string
): Promise<string> {
  const prompt = promptTemplate
    .replace("{company_name}", companyName)
    .replace("{domain}", domain);

  const response = await callPerplexity([
    {
      role: "system",
      content: `You are a research assistant. Search the web for company information.
Only use information from the specified domain.
If you cannot find reliable information, respond with an empty string.
Do not make up or hallucinate any information.`,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  // Clean up response - if it contains uncertainty phrases, return empty
  const lowerResponse = response.toLowerCase();
  if (
    lowerResponse.includes("couldn't find") ||
    lowerResponse.includes("could not find") ||
    lowerResponse.includes("unable to find") ||
    lowerResponse.includes("no information") ||
    lowerResponse.includes("not available") ||
    response.length < 50 // Too short to be meaningful
  ) {
    return "";
  }

  return response.trim();
}

export { callPerplexity };
