import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API integration
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.post("/api/usage-report", async (req, res) => {
    try {
      const { usageData } = req.body;
      const prompt = `
        You are an expert child psychologist and digital wellness advisor. 
        Analyze the following screen time usage for a child named ${usageData.childName || "Mariam"}.
        
        Usage Data:
        - Total Time: ${usageData.totalTime} minutes
        - Apps: ${usageData.apps.map((a: any) => `${a.name} (${a.time} min, Category: ${a.category})`).join(', ')}
        - Date: ${usageData.date}

        Please provide:
        1. A brief summary of her activity.
        2. Specific insights about her usage of YouTube, WhatsApp, and Games (like Roblox/Minecraft).
        3. A supportive recommendation for the parents on how to balance this usage.
        4. Keep the tone friendly, expert, and reassuring. The response should be in Arabic as requested by the user, or bilingual (Arabic/English) if appropriate, but primarily focus on the user's language.
      `;
      
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      
      res.json({ report: result.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
