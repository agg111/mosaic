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
    const appId = data.app_id ?? "";

    // Render the success page directly — never put the token in the URL
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(successPage(botToken, teamName, appId));
  } catch (e) {
    res.redirect("/?error=server_error");
  }
}

function successPage(token, teamName, appId) {
  const escapedToken = token.replace(/`/g, "\\`");
  const appTokenUrl = appId
    ? `https://api.slack.com/apps/${appId}/general`
    : "https://api.slack.com/apps";
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
      max-width: 580px;
      padding: 48px 32px;
      width: 100%;
    }
    .check { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .sub { color: #888; margin-bottom: 40px; font-size: 15px; }
    .step { margin-bottom: 32px; }
    .step-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      margin-bottom: 8px;
    }
    .step-desc {
      font-size: 13px;
      color: #888;
      margin-bottom: 10px;
      line-height: 1.5;
    }
    .step-desc a {
      color: #7c9ef8;
      text-decoration: none;
    }
    .step-desc a:hover { text-decoration: underline; }
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
    .open-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1a1a2e;
      border: 1px solid #333;
      color: #7c9ef8;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      text-decoration: none;
      margin-bottom: 10px;
    }
    .open-btn:hover { background: #222; }
    .note { color: #555; font-size: 13px; margin-top: 32px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Slack authorized</h1>
    <p class="sub">Two quick steps and you're done.</p>

    <div class="step">
      <div class="step-label">Step 1 — Copy your bot token into the terminal</div>
      <div class="command">
        <span id="bot-token">${escapedToken}</span>
        <button class="copy-btn" onclick="copy('bot-token', this)">Copy</button>
      </div>
    </div>

    <div class="step">
      <div class="step-label">Step 2 — Create an App-Level Token</div>
      <div class="step-desc">
        Mosaic needs one more token to connect to Slack in real time.
        Open your app settings, scroll to <strong>App-Level Tokens</strong>,
        click <strong>Generate Token</strong>, add the <code style="color:#aaa">connections:write</code> scope, and copy the <code style="color:#aaa">xapp-</code> token.
      </div>
      <a class="open-btn" href="${appTokenUrl}" target="_blank">
        Open Slack app settings ↗
      </a>
    </div>

    <div class="step">
      <div class="step-label">Step 3 — Start Mosaic</div>
      <div class="command">mosaic start</div>
    </div>

    <p class="note">Then @mention Mosaic in any Slack channel or DM it directly.</p>
  </div>

  <script>
    function copy(id, btn) {
      navigator.clipboard.writeText(document.getElementById(id).textContent);
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 2000);
    }
  </script>
</body>
</html>`;
}
