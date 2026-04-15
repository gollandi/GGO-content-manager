import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  try {
    const { url, text, mode } = await req.json();

    const contentToValidate = text || `Validate content at URL: ${url}`;

    // Using the latest pro model as requested
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" });

    let systemPrompt = "";

    if (mode === "readability") {
      systemPrompt = `
        You are a Health Literacy and Readability Expert. 
        Evaluate the following health information content for "Patient Readability".
        
        STRICT RULES:
        1. Tier 1 Content (Immediately visible text, non-nested): Target reading age MUST be 9-11 years old.
        2. Tier 2 Content (Nested text, accordions, expandable sections): Can be of a higher educational level (e.g., 14-16+) as it is for users seeking deeper detail.
        
        Provide a concise analysis focusing ONLY on whether Tier 1 meets the 9-11 year old target.
        Identify any complex jargon in Tier 1 that should be simplified. Use the provided text as the source.
      `;
    } else if (mode === "inclusivity") {
      systemPrompt = `
        You are an Inclusivity and Diversity Consultant.
        Evaluate the following health information content for "Inclusivity Assessment".
        
        Check for:
        - Gender-neutral language where appropriate.
        - Consideration of different ethnic backgrounds, ages, and abilities.
        - Avoiding stereotypes.
        
        Provide a concise analysis of how inclusive the content is and suggest improvements.
      `;
    } else {
      systemPrompt = `
        You are a PIF TICK Compliance Expert. Evaluate health information content against PIF TICK Principles.
        
        PRINCIPLES:
        1. Evidence-Based
        2. Content Need
        3. Patient Readability (Tier 1: 9-11 years old target; Tier 2: can be higher)
        4. Inclusivity
        5. Expert Peer Review
        6. Transparency
        7. Balance
        8. Clarity
        9. Relevance
        10. Accuracy

        Respond in JSON format:
        {
          "status": "✅ YES" | "❌ NO",
          "scores": { "accuracy": 0-100, "evidence": 0-100, "readability": 0-100, "inclusivity": 0-100, "transparency": 0-100 },
          "findings": [{ "principle": "string", "pass": boolean, "note": "string" }],
          "summary": "string"
        }
      `;
    }

    const result = await model.generateContent([systemPrompt, contentToValidate]);
    const response = await result.response;
    let responseText = response.text();

    if (!mode || mode === "default") {
      if (responseText.includes("```json")) {
        responseText = responseText.split("```json")[1].split("```")[0];
      } else if (responseText.includes("```")) {
        responseText = responseText.split("```")[1].split("```")[0];
      }
      return NextResponse.json(JSON.parse(responseText.trim()));
    } else {
      return NextResponse.json({ analysis: responseText.trim() });
    }
  } catch (error: unknown) {
    console.error("AI Validation Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI validation failed" }, { status: 500 });
  }
}
