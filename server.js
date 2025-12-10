import express from "express";
import neo4j from "neo4j-driver";
import { randomUUID } from "crypto";

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

// Example: return all vocab words (full details)
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

// --- API endpoint used by ChatGPT / frontend ---
app.get("/api/words", async (req, res) => {
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

    const words = result.records.map((r, index) => ({
      id: index, // simple index for now
      text: r.get("text"),
      gender: r.get("gender"),
      pos: r.get("pos"),
      difficulty: r.get("difficulty"),
      frequency: r.get("frequency"),
    }));

    res.json({ words });
  } catch (err) {
    console.error("Error in /api/words:", err);
    res.status(500).json({ error: "Failed to fetch words" });
  } finally {
    await session.close();
  }
});

// --- Create a new learning session ---
app.post("/api/session", async (req, res) => {
  const session = driver.session();
  const sessionId = randomUUID();

  try {
    const result = await session.run(
      `
      CREATE (s:Session {
        sessionId: $sessionId,
        score: 0,
        level_estimate: null,
        confidence: null,
        timestamp: datetime()
      })
      RETURN s.sessionId AS sessionId
      `,
      { sessionId }
    );

    const createdId = result.records[0].get("sessionId");
    res.json({ sessionId: createdId });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  } finally {
    await session.close();
  }
});

// --- Log a learner response and update VocabError ---
app.post("/api/log-response", async (req, res) => {
  const session = driver.session();

  const {
    sessionId,
    wordText,
    exerciseType,
    prompt,
    userAnswer,
    correct
  } = req.body;

  if (!sessionId || !wordText || !prompt || typeof correct !== "boolean") {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const exerciseId = randomUUID();

    const result = await session.run(
      `
      // Find the session and the word
      MATCH (s:Session {sessionId: $sessionId})
      MATCH (w:Word {text: $wordText})

      // Create the exercise node
      CREATE (e:Exercise {
        id: $exerciseId,
        type: $exerciseType,
        prompt: $prompt
      })

      // Create the response node
      CREATE (r:Response {
        text: $userAnswer,
        timestamp: datetime(),
        correct: $correct
      })

      // Connect session to response
      CREATE (s)-[:GAVE_RESPONSE]->(r)

      // Connect exercise to word
      CREATE (e)-[:TARGETS]->(w)

      // If incorrect, update VocabError and link to session
      FOREACH (_ IN CASE WHEN $correct = false THEN [1] ELSE [] END |
        MERGE (ve:VocabError {word: $wordText})
        ON CREATE SET ve.count = 1
        ON MATCH SET ve.count = coalesce(ve.count, 0) + 1
        MERGE (s)-[:HAD_VOCAB_ERROR]->(ve)
      )

      RETURN r.correct AS correct,
             w.text AS word,
             $sessionId AS sessionId
      `,
      {
        sessionId,
        wordText,
        exerciseType: exerciseType || "unknown",
        prompt,
        userAnswer,
        correct
      }
    );

    const record = result.records[0];
    res.json({
      sessionId: record.get("sessionId"),
      word: record.get("word"),
      correct: record.get("correct")
    });
  } catch (error) {
    console.error("Error logging response:", error);
    res.status(500).json({ error: "Failed to log response" });
  } finally {
    await session.close();
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
