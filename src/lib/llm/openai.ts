import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CleanCompanyInput {
  company_id: string;
  company_name: string;
  address?: string;
  description?: string;
}

export interface CleanCompanyOutput {
  company_id: string;
  formatted_company_name: string;
  formatted_address: string;
  determined_company_type: "seller" | "buyer" | null;
  enriched_description: string;
}

export async function cleanAndEnrichCompanies(
  companies: CleanCompanyInput[],
  promptTemplate: string
): Promise<CleanCompanyOutput[]> {
  const prompt = promptTemplate.replace("{companies}", JSON.stringify(companies, null, 2));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a data cleaning assistant. Always respond with valid JSON arrays.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from OpenAI");

  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.companies || parsed.results || [];
}

export interface ValidateCompanyInput {
  name?: string;
  domain?: string;
  address?: string;
  description?: string;
  company_type?: string;
}

export interface ValidationResult {
  is_valid: boolean;
  issues: string[];
  suggestions: string[];
}

export async function validateCompanyData(
  company: ValidateCompanyInput,
  promptTemplate: string
): Promise<ValidationResult> {
  const prompt = promptTemplate.replace("{company_data}", JSON.stringify(company, null, 2));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a data validation assistant. Respond with JSON containing is_valid, issues, and suggestions.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from OpenAI");

  return JSON.parse(content);
}

export async function mapCSVSchema(
  csvHeaders: string[],
  targetSchema: string[],
  promptTemplate: string
): Promise<Record<string, string | null>> {
  const prompt = promptTemplate
    .replace("{csv_headers}", JSON.stringify(csvHeaders))
    .replace("{target_schema}", JSON.stringify(targetSchema));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from OpenAI");

  return JSON.parse(content);
}

export { openai };
