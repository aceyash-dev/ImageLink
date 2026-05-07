import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
  const { code, w, h, q, f, c } = req.query;

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  try {
    // 1. Fetch links data from GitHub
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

    let targetUrl = links[code].url;

    // 2. Smart Detection: Image Proxy vs Standard Redirect
    const isCloudinaryImage = targetUrl.includes("res.cloudinary.com") && targetUrl.includes("/upload/");

    if (isCloudinaryImage) {
      // --- On-the-Fly Transformations for Images ---
      const transforms = [];
      
      if (w) transforms.push(`w_${w}`);
      if (h) transforms.push(`h_${h}`);
      if (q) transforms.push(`q_${q}`);
      if (f) transforms.push(`f_${f}`);
      if (c) transforms.push(`c_${c}`);
      
      if (!f) transforms.push("f_auto");

      if (transforms.length > 0) {
        const transformString = transforms.join(",");
        targetUrl = targetUrl.replace("/upload/", `/upload/${transformString}/`);
      }

      // 3. Proxy the Image
      const imageResponse = await fetch(targetUrl);
      
      if (!imageResponse.ok) {
        return res.status(imageResponse.status).send("Failed to fetch image from origin.");
      }

      // Forward Correct Headers & Set Aggressive Edge Caching for Zero Lag delivery
      const contentType = imageResponse.headers.get("content-type");
      res.setHeader("Content-Type", contentType || "image/jpeg");
      res.setHeader("Cache-Control", "public, s-maxage=31536000, stale-while-revalidate");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const arrayBuffer = await imageResponse.arrayBuffer();
      return res.status(200).send(Buffer.from(arrayBuffer));

    } else {
      // --- Standard Redirect for Regular Links ---
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
      return res.redirect(302, targetUrl);
    }

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(500).send("Server error");
  }
}
