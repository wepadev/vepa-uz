/**
 * YouTube havolasidan video ID va rasm (thumbnail) olish.
 * Ham YouTubeEmbed, ham dars kartalari shu yerdan foydalanadi.
 */
export function getYouTubeVideoId(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    const hostname = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname === "youtu.be") {
      return (
        url.pathname
          .split("/")
          .filter(Boolean)[0] ?? null
      );
    }

    const youtubeHosts = [
      "youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtube-nocookie.com",
    ];

    if (!youtubeHosts.includes(hostname)) {
      return null;
    }

    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const parts = url.pathname
      .split("/")
      .filter(Boolean);

    if (
      parts[0] === "shorts" ||
      parts[0] === "embed" ||
      parts[0] === "live"
    ) {
      return parts[1] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeThumbnail(
  value: string | null | undefined,
) {
  const videoId = getYouTubeVideoId(value);

  if (!videoId) {
    return null;
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
