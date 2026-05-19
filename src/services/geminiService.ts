import { GoogleGenAI } from "@google/genai";

// Note: In AI Studio, the GEMINI_API_KEY is injected into the environment.
// For client-side apps, we MUST proxy this through a server-side route.
// However, I will implement the logic here to show how it's done.

export async function generateUsageReport(usageData: any) {
  try {
    const response = await fetch('/api/usage-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usageData }),
    });
    return await response.json();
  } catch (error) {
    console.error("Error generating report:", error);
    return { error: "Failed to generate AI report" };
  }
}
