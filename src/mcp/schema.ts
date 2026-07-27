import { z } from "zod";

type JsonProperty = {
  type?: string;
  description?: string;
  minimum?: number;
};

export type OpenAiToolParameters = {
  type?: string;
  properties?: Record<string, JsonProperty>;
  required?: readonly string[];
};

/** Convert OpenAI-style tool parameters to a Zod object for MCP `registerTool`. */
export function openAiParametersToZodShape(parameters: OpenAiToolParameters): z.ZodObject<z.ZodRawShape> {
  const properties = parameters.properties ?? {};
  const required = new Set(parameters.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, spec] of Object.entries(properties)) {
    let field: z.ZodTypeAny;
    switch (spec.type) {
      case "boolean":
        field = z.boolean();
        break;
      case "integer":
        field = z.number().int();
        if (typeof spec.minimum === "number") {
          field = (field as z.ZodNumber).min(spec.minimum);
        }
        break;
      case "number":
        field = z.number();
        break;
      case "object":
        field = z.record(z.string(), z.unknown());
        break;
      default:
        field = z.string();
    }
    if (spec.description) {
      field = field.describe(spec.description);
    }
    if (!required.has(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  return z.object(shape);
}
