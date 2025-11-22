/**
 * Fetches ICE servers (STUN/TURN) from our own API route (which calls Cloudflare).
 * This keeps the Cloudflare API Token secure on the server side.
 * @returns {Promise<RTCIceServer[]>} Array of ICE server configurations.
 */
export const getIceServers = async () => {
  try {
    // Call our own Vercel API route
    const response = await fetch("/api/ice-servers");

    // Check if the response is JSON (Vite returns HTML for unknown routes)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      console.warn(
        "ICE servers API route not found (received HTML). If running locally, use 'vercel dev' to support serverless functions. Falling back to public STUN servers."
      );
      throw new Error("API route not available");
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch ICE servers: ${response.statusText}`);
    }

    const data = await response.json();
    return data.iceServers;
  } catch (error) {
    console.error("Error fetching ICE servers:", error);
    // Fallback to Google STUN servers if API fails
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  }
};
