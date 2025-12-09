import express from "express";
import neo4j from "neo4j-driver";

const app = express();
app.use(express.json());

// --- Neo4j connection ---
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Simple test endpoint
app.get("/", (req, res) => {
  res.send("Neo4j Tutor Server is running.");
});

// Example: return all vocab words
app.get("/vocab", async (req, res) => {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (w:Word)
      RETURN w.word AS word, w.translation AS translation
    `);

    const words = result.records.map(r => ({
      word: r.get("word"),
      translation: r.get("translation")
    }));

    res.json({ words });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Query failed." });
  } finally {
    await session.close();
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
