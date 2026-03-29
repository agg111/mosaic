export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${error}`);
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
      return res.redirect(`/?error=${data.error}`);
    }

    const botToken = data.access_token;
    const teamName = data.team?.name ?? "your workspace";

    res.redirect(`/success?token=${encodeURIComponent(botToken)}&team=${encodeURIComponent(teamName)}`);
  } catch (e) {
    res.redirect(`/?error=server_error`);
  }
}
