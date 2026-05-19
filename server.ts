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
        - Apps Analysis: ${usageData.apps.map((a: any) => `${a.name} (${a.time} min, ${a.opens} launches, Category: ${a.category})`).join(', ')}
        - Hourly Patterns: ${JSON.stringify(usageData.hourlyUsage)}
        - Late Night Detections: ${JSON.stringify(usageData.nightUsage || "None detected")}
        - Date: ${usageData.date}

        Please provide a detailed report in Arabic including:
        1. ملخص النشاط (Activity Summary): A brief summary of her activity.
        2. تحليل الإدمان (Addiction Analysis): Identify if any apps have high launch counts (potential addiction) or excessive time.
        3. تحليل النوم (Sleep Impact): Specifically comment on the ${usageData.nightUsage?.length > 0 ? "detections of late-night usage" : "lack of late-night usage"} and its impact.
        4. درجة التركيز (Focus Score): Evaluate her focus score (0-100) based on educational vs entertainment ratio.
        5. توصيات الخبراء (Expert Recommendations): Supportive advice for parents to maintain healthy habits.
        
        Keep the tone friendly, expert, and reassuring. The entire response SHOULD BE IN ARABIC.
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
