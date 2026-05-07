import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { url, note, alias } = req.body;
  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  // 1. Strict URL Validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ message: "Invalid URL provided." });
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = "links.json";

  let links = {};
  let sha;

  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    sha = data.sha;
    links = JSON.parse(Buffer.from(data.content, "base64").toString());
  } catch (e) {
    // File may not exist yet
  }

  // 2. Custom Alias & Collision Handling
  let code;
  if (alias) {
    code = alias.replace(/[^a-zA-Z0-9-_]/g, '');
    if (!code) return res.status(400).json({ message: "Invalid alias format." });
    if (links[code]) return res.status(409).json({ message: "Alias is already in use. Please choose another." });
  } else {
    do {
      code = Math.random().toString(36).substring(2, 7);
    } while (links[code]);
  }

  links[code] = {
    url,
    note,
    createdAt: new Date().toISOString(),
    clicks: 0,
  };

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Add link ${code}`,
    content: Buffer.from(JSON.stringify(links, null, 2)).toString("base64"),
    sha,
  });

  const baseUrl =
    process.env.BASE_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  res.status(200).json({
    shortUrl: `${baseUrl}/${code}`,
    code,
  });
}
