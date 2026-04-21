import express from "express";
import { GoogleGenAI } from "@google/genai";

try {
    process.loadEnvFile();
} catch (error) {
    console.warn("Could not load .env file: ", error.message);
}

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "50mb" }));

const ai = new GoogleGenAI({});

app.post("/food-analysis", async (req, res) => {
    try {
        const { base64, mimeType } = req.body;

        if (!base64 || !mimeType) {
            return res.status(400).json({ error: "Missing image data" });
        }

        const promptText = `Sen bir beslenme uzmanısın. Bu yemek fotoğrafını analiz et ve SADECE aşağıdaki JSON formatında yanıt ver. 
  JSON dışında hiçbir açıklama ekleme.
  {
    "foodName": "Yemeğin adı",
    "totalCalories": 500,
    "multipleDishes": false,
    "dishes": [],
    "activities": {"walking": 30, "running": 15, "cycling": 20, "swimming": 10},
    "funFact": "Kısa bilgi",
    "healthNote": "Kısa not"
  }`;

        const result = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64,
                    },
                },
                { text: promptText },
            ],
        });

        const rawText = result.text;
        const cleanJSON = rawText.replace(/\`\`\`json|\`\`\`/g, "").trim();
        const parsed = JSON.parse(cleanJSON);

        res.json(parsed);
    } catch (error) {
        console.error("Analysis error:", error);
        res.status(500).json({
            error: "Analysis failed",
            details: error.message,
        });
    }
});

app.listen(port);
