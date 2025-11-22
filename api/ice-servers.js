export default async function handler(request, response) {
  const CLOUDFLARE_TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;
  const CLOUDFLARE_TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!CLOUDFLARE_TURN_KEY_ID || !CLOUDFLARE_TURN_API_TOKEN) {
    console.error("Missing Cloudflare credentials in environment variables");
    return response.status(500).json({ error: "Server configuration error" });
  }

  try {
    const cloudflareResponse = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_TURN_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }), // 24 hours TTL
      }
    );

    if (!cloudflareResponse.ok) {
      const errorText = await cloudflareResponse.text();
      console.error(
        "Cloudflare API error:",
        cloudflareResponse.status,
        errorText
      );
      return response
        .status(cloudflareResponse.status)
        .json({ error: "Failed to fetch ICE servers" });
    }

    const data = await cloudflareResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    console.error("Error fetching ICE servers:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
