import { getProvider } from "@/lib/providers";
import { NewsFeed } from "@/components/news/NewsFeed";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const provider = getProvider();
  const news = await provider.getNews(undefined, 30);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-4 py-4">
        <NewsFeed news={news} />
      </div>
    </div>
  );
}
