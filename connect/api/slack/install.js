export default function handler(req, res) {
  const scopes = [
    "app_mentions:read",
    "chat:write",
    "channels:history",
    "channels:read",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "im:write",
    "mpim:history",
    "mpim:read",
  ].join(",");

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", process.env.SLACK_CLIENT_ID);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", process.env.SLACK_REDIRECT_URI);

  res.redirect(url.toString());
}
