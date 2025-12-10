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
      RETURN 
        w.text AS text,
        w.gender AS gender,
        w.pos AS pos,
        w.difficulty AS difficulty,
        w.frequency AS frequency
    `);

    const words = result.records.map(r => ({
      text: r.get("text"),
      gender: r.get("gender"),
      pos: r.get("pos"),
      difficulty: r.get("difficulty"),
      frequency: r.get("frequency"),
    }));

    res.json({ words });
  } catch (error) {
    console.error("Error fetching vocab:", error);
    res.status(500).json({ error: "Failed to fetch vocab" });
  } finally {
    await session.close();
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
