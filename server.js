// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require("express");
const axios = require("axios");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");


const app = express();
const port = 3000;

app.use(express.json());

// Use credentials from environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let userAccessToken = null;
let userReposCache = [];

app.use(express.static(__dirname));

app.get("/callback", (req, res) => {
  const code = req.query.code;
  // If in development, redirect to Vite dev server (port 5173 or similar)
  // If in production (frontend served by this server), redirect to /callback route of SPA
  
  // For now, we assume development mode or separate frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/callback?code=${code}`);
});

// Provide client-side config (client ID + redirect URI) so frontend doesn't hard-code values
app.get("/client-config", (req, res) => {
  // Allow override via env var for deployments; default to local callback
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `http://localhost:${port}/callback`;
  console.log(`/client-config requested — clientId set: ${!!GITHUB_CLIENT_ID}, redirectUri: ${redirectUri}`);

  // If the server is not configured with a client ID, return an error for clear client-side handling
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "Server is not configured with a GitHub client ID" });
  }

  res.json({
    clientId: GITHUB_CLIENT_ID,
    redirectUri: redirectUri,
  });
});

// Function to fetch the default branch of a repository
async function getDefaultBranch(owner, repo, token) {
  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoResponse = await axios.get(repoUrl, {
    headers: { Authorization: `token ${token}` },
  });
  return repoResponse.data.default_branch;
}

// This endpoint receives the code and returns the user's repos
// REVISED /get-repos ENDPOINT WITH DEBUG LOGGING
app.get("/get-repos", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    console.log("Error: Authorization code is missing.");
    return res.status(400).json({ error: "Authorization code is missing" });
  }

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      console.log("Error: Failed to retrieve access token from response.");
      return res
        .status(500)
        .json({ error: "Failed to retrieve access token." });
    }
    userAccessToken = accessToken;

    const [userResponse, reposResponse] = await Promise.all([
      axios.get("https://api.github.com/user", {
        headers: { Authorization: `token ${userAccessToken}` },
      }),
      axios.get("https://api.github.com/user/repos", {
        headers: { Authorization: `token ${userAccessToken}` },
        params: { sort: "updated", direction: "desc", per_page: 100 },
      }),
    ]);

    userReposCache = reposResponse.data;

    res.json({
      userData: userResponse.data,
      reposData: userReposCache,
    });

  } catch (error) {
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// New AI Search Endpoint - Now with File Search
app.post("/ai-search", async (req, res) => {
  const { query } = req.body;
  if (!query)
    return res.status(400).json({ error: "Search query is missing." });
  if (!userAccessToken)
    return res.status(401).json({ error: "User is not authenticated." });

  try {
    // Step 1: Find relevant repositories
    const reposForPrompt = userReposCache.map((repo) => ({
      name: repo.name,
      description: repo.description || "",
    }));
    const repoPrompt = `
            User Query: "${query}"
            Available Repositories: ${JSON.stringify(reposForPrompt)}
            Based on the query, which repositories are most relevant? Return ONLY a JSON array of repository names. If none, return [].`;

    let repoResult = await model.generateContent(repoPrompt);
    let relevantRepoNames = [];
    try {
      const text = repoResult.response.text();
      const match = text.match(/\[[\s\S]*\]/);
      relevantRepoNames = JSON.parse(match ? match[0] : text);
    } catch(e) {
      console.error("Failed to parse repo names", repoResult.response.text());
    }

    const relevantRepos = userReposCache.filter((repo) =>
      relevantRepoNames.includes(repo.name)
    );
    let finalResults = [];

    // Step 2: For each relevant repo, find relevant files
    for (const repo of relevantRepos) {
      try {
        const defaultBranch = await getDefaultBranch(
          repo.owner.login,
          repo.name,
          userAccessToken
        );
        const treeUrl = `https://api.github.com/repos/${repo.owner.login}/${repo.name}/git/trees/${defaultBranch}?recursive=1`;
        const treeResponse = await axios.get(treeUrl, {
          headers: { Authorization: `token ${userAccessToken}` },
        });
        const fileNodes = treeResponse.data.tree.filter(
          (node) => node.type === "blob"
        );
        const filePaths = fileNodes.map((node) => node.path);

        const filePrompt = `
            User Query: "${query}"
            Files in repository "${repo.name}": ${JSON.stringify(filePaths)}
            Based on the query, which files are most relevant? Return ONLY a JSON array of the full file paths. If none, return [].`;

        let fileResult = await model.generateContent(filePrompt);
        let relevantFilePaths = [];
        try {
          const text = fileResult.response.text();
          const match = text.match(/\[[\s\S]*\]/);
          relevantFilePaths = JSON.parse(match ? match[0] : text);
        } catch(e) {
          console.error("Failed to parse file names", fileResult.response.text());
        }

        if (relevantFilePaths.length > 0) {
          let foundFile = false;
          relevantFilePaths.forEach((path) => {
            // Find the full file node to get the SHA
            const fileNode = fileNodes.find((node) => node.path === path);
            if (fileNode) {
              finalResults.push({
                type: "file",
                data: {
                  path: path,
                  name: path.split("/").pop(),
                  sha: fileNode.sha, // <-- ADDED SHA HERE
                  repo: {
                    name: repo.name,
                    owner: { login: repo.owner.login },
                  },
                },
              });
              foundFile = true;
            }
          });
          if (!foundFile) {
            finalResults.push({ type: "repo", data: repo });
          }
        } else {
          finalResults.push({ type: "repo", data: repo });
        }
      } catch (treeError) {
        console.error(
          `Could not process files for ${repo.name}: ${treeError.message}`
        );
        finalResults.push({ type: "repo", data: repo });
      }
    }

    // If the initial repo search found nothing, say so.
    if (finalResults.length === 0 && relevantRepos.length === 0) {
      return res.json({ results: [] });
    }

    res.json({ results: finalResults });
  } catch (error) {
    console.error(
      "Error in AI search:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "An error occurred during the AI search." });
  }
});

// Other endpoints remain the same...

app.get("/get-repo-contents", async (req, res) => {
  const { owner, repo, path = "" } = req.query;
  if (!userAccessToken)
    return res.status(401).json({ error: "User is not authenticated." });
  if (!owner || !repo)
    return res
      .status(400)
      .json({ error: "Repository owner and name are required." });
  try {
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const contentsResponse = await axios.get(contentsUrl, {
      headers: {
        Authorization: `token ${userAccessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    res.json(contentsResponse.data);
  } catch (error) {
    console.error("Error fetching repository contents:", error.message);
    res.status(500).json({ error: "Failed to fetch repository contents." });
  }
});

app.get("/get-file-content", async (req, res) => {
  const { owner, repo, path } = req.query;
  if (!userAccessToken)
    return res.status(401).json({ error: "User is not authenticated." });
  if (!owner || !repo || !path)
    return res
      .status(400)
      .json({ error: "Owner, repo, and file path are required." });
  try {
    const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const contentResponse = await axios.get(contentUrl, {
      headers: {
        Authorization: `token ${userAccessToken}`,
        Accept: "application/vnd.github.v3.raw",
      },
      // Important: Tell axios to receive the response as a raw buffer
      responseType: "arraybuffer",
    });

    // Get the content type from the GitHub response and set it for our response
    const contentType = contentResponse.headers["content-type"];
    res.set("Content-Type", contentType);
    res.send(contentResponse.data);
  } catch (error) {
    console.error("Error fetching file content:", error.message);
    res.status(500).json({ error: "Failed to fetch file content." });
  }
});

app.post("/commit-file", async (req, res) => {
  if (!userAccessToken) {
    return res.status(401).json({ error: "User is not authenticated." });
  }
  const { owner, repo, path, message, content, sha } = req.body;
  if (!owner || !repo || !path || !message || content === undefined || !sha) {
    return res.status(400).json({ error: "Missing required commit data." });
  }
  try {
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const encodedContent = Buffer.from(content).toString("base64");
    const commitData = {
      message: message,
      content: encodedContent,
      sha: sha,
    };
    const commitResponse = await axios.put(commitUrl, commitData, {
      headers: {
        Authorization: `token ${userAccessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    res.json({ success: true, data: commitResponse.data });
  } catch (error) {
    console.error(
      "Error committing file:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to commit file." });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
