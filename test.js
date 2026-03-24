require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function test() {
  const query = "Find my repo about a React portfolio";
  const reposForPrompt = [
    { name: "my-portfolio", description: "A simple react portfolio" },
    { name: "other-repo", description: "testing" }
  ];
  
  const repoPrompt = `
            User Query: "${query}"
            Available Repositories: ${JSON.stringify(reposForPrompt)}
            Based on the query, which repositories are most relevant? Return ONLY a JSON array of repository names. If none, return [].`;

  try {
    const repoResult = await model.generateContent(repoPrompt);
    const text = repoResult.response.text();
    console.log("Raw Response:\n", text);
    
    let relevantRepoNames = JSON.parse(
      text
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim()
    );
    console.log("Parsed Array:", relevantRepoNames);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
