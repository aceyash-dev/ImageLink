import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
  const { code } = req.query;

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  try {
    const { data } = await octokit.repos.getContent({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: "links.json",
    });

    const links = JSON.parse(
      Buffer.from(data.content, "base64").toString()
    );

    if (!links[code]) {
      return res.status(404).send("Link not found");
    }

    return res.redirect(302, links[code].url);
  } catch (error) {
    return res.status(500).send("Server error");
  }
}
