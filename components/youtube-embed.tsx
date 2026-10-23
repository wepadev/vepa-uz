import { getYouTubeVideoId } from "@/lib/youtube";

type YouTubeEmbedProps = {
  url: string | null | undefined;
  title?: string;
};

export default function YouTubeEmbed({
  url,
  title = "Videoyechim",
}: YouTubeEmbedProps) {
  if (!url) {
    return null;
  }

  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        YouTube havolasi noto‘g‘ri kiritilgan.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm">
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          className="h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}