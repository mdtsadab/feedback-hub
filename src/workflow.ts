export interface FeedbackPayload {
  message: string;
  source?: string;
  product?: string;
}

export interface Env {
  AI: Ai;
  DB: D1Database;
}

export class FeedbackWorkflow {
  async run(event: { payload: FeedbackPayload }, env: Env) {
    const {
      message,
      source = "unknown",
      product = "unknown"
    } = event.payload;

    // STEP 1: Validate
    if (!message.trim()) {
      throw new Error("Feedback message is required");
    }

    // STEP 2: Analyze with Workers AI
    const analysis = await env.AI.run(
      "@cf/meta/llama-3-8b-instruct",
      {
        messages: [
          {
            role: "system",
            content:
              "You analyze Cloudflare customer feedback and summarize key issues."
          },
          {
            role: "user",
            content: `
Product: ${product}
Source: ${source}

Feedback:
${message}

Provide a concise 2–3 sentence summary.
`
          }
        ],
        max_tokens: 256
      }
    );

    const summary = analysis.response ?? analysis;

    // STEP 3: Persist to D1
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO feedback (id, message, source, product, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
      .bind(id, message, source, product, String(summary), createdAt)
      .run();

    // STEP 4: Return result
    return {
      id,
      summary
    };
  }
}
