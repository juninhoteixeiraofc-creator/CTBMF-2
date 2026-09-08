import express from "express";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/chefinho", async (req, res) => {
    const { question, systemPrompt } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY not configured on server." });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
          temperature: 0.1,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ error: errorData.error?.message || "OpenAI API error" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Server: OpenAI error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test connection route
  app.post("/api/test-connection", async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY not configured." });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "SIM" }],
          max_tokens: 5
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ error: errorData.error?.message || "OpenAI API error" });
      }

      const data = await response.json();
      res.json({ success: true, model: "gpt-4o-mini", data });
    } catch {
      res.status(500).json({ error: "Connection test failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
