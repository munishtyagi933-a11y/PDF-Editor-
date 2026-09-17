import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Lazy initialize Gemini
let genAI: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "PDF With Munish" });
});

app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { prompt, text, mode } = req.body;
    if (!text && !prompt) {
      return res.status(400).json({ error: "Missing document content or prompt" });
    }

    const ai = getGenAI();
    const systemInstruction =
      "You are an expert, professional PDF document analysis assistant in 'PDF With Munish'. Provide clear, accurate, actionable answers. Format with clean Markdown (bullet points, clear headers, concise tables if helpful). Highlight risks, key dates, monetary values, and obligations if applicable.";

    let userMessage = "";
    if (mode === "summarize") {
      userMessage = `Please provide a thorough executive summary of this document, organized with Overview, Main Points, and Key Takeaways:\n\n${text.slice(0, 32000)}`;
    } else if (mode === "key_points") {
      userMessage = `Extract the critical details from this document: parties involved, important dates/deadlines, financial/numerical terms, obligations/action items, and any warnings or conditions:\n\n${text.slice(0, 32000)}`;
    } else if (mode === "qa") {
      userMessage = `Based on the following document context:\n\n${text.slice(0, 32000)}\n\nQuestion: ${prompt}\n\nPlease give a direct, helpful, and accurate response based on the document text.`;
    } else {
      userMessage = `${prompt || "Analyze the following document"}\n\nDocument text:\n${text ? text.slice(0, 32000) : "None"}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userMessage,
      config: {
        systemInstruction,
      },
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("AI Analysis error:", error);
    res.status(500).json({
      error: error.message || "Failed to analyze document with AI. Please verify your GEMINI_API_KEY in settings.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PDF With Munish server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
