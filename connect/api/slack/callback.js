export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return res.redirect(`/?error=${encodeURIComponent(data.error)}`);
    }

    const botToken = data.access_token;
    const teamName = data.team?.name ?? "your workspace";

    // Render the success page directly — never put the token in the URL
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(successPage(botToken, teamName));
  } catch (e) {
    res.redirect("/?error=server_error");
  }
}

function successPage(token, teamName) {
  const escaped = token.replace(/`/g, "\\`");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mosaic — Slack Connected</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      max-width: 560px;
      padding: 48px 32px;
      width: 100%;
    }
    .check { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .sub { color: #888; margin-bottom: 40px; font-size: 15px; }
    .step { margin-bottom: 28px; }
    .step-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      margin-bottom: 8px;
    }
    .command {
      background: #111;
      border: 1px solid #222;
      border-radius: 6px;
      padding: 14px 16px;
      font-family: "SF Mono", monospace;
      font-size: 13px;
      color: #0f0;
      position: relative;
      word-break: break-all;
    }
    .copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #222;
      border: none;
      color: #aaa;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    .copy-btn:hover { background: #333; color: #fff; }
    .note { color: #555; font-size: 13px; margin-top: 32px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Slack connected</h1>
    <p class="sub">${teamName} is connected.</p>

    <div class="step">
      <div class="step-label">Step 1 — Paste this command into your terminal</div>
      <div class="command">
        <span id="cmd-text">mosaic set-slack-token ${escaped}</span>
        <button class="copy-btn" onclick="copyCmd()">Copy</button>
      </div>
    </div>

    <div class="step">
      <div class="step-label">Step 2 — Start Mosaic</div>
      <div class="command">mosaic start</div>
    </div>

    <p class="note">Then @mention Mosaic in any Slack channel or DM it directly.</p>
  </div>

  <script>
    function copyCmd() {
      const text = document.getElementById("cmd-text").textContent;
      navigator.clipboard.writeText(text);
      document.querySelector(".copy-btn").textContent = "Copied!";
      setTimeout(() => document.querySelector(".copy-btn").textContent = "Copy", 2000);
    }
  </script>
</body>
</html>`;
}
