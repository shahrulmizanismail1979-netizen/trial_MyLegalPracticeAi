import { useCrimGetTopic, getCrimGetTopicQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, BookOpen, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function TopicDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data: topic, isLoading, error } = useCrimGetTopic(id, {
    query: { enabled: !!id, queryKey: getCrimGetTopicQueryKey(id) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
        </div>
        <Skeleton className="h-[400px] w-full mt-8" />
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Topic not found</h2>
        <p className="text-muted-foreground mt-2">The topic you're looking for doesn't exist or has been removed.</p>
        <Link href="/workspace/topics">
          <Button className="mt-6">Back to Topics</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link href="/workspace/topics">
        <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Topics
        </Button>
      </Link>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1">
              <Tag className="h-3 w-3" />
              {topic.category}
            </Badge>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(topic.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight">
            {topic.title}
          </h1>
          
          <p className="text-xl text-muted-foreground leading-relaxed">
            {topic.description}
          </p>
        </header>

        <Separator className="bg-border/60" />

        <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-bold prose-h2:text-3xl prose-h3:text-2xl prose-a:text-primary hover:prose-a:text-primary/80">
          {/* We're doing dangerouslySetInnerHTML because content from the API is likely rich text/markdown converted to HTML.
              In a real app, you'd use a markdown parser or sanitize this. */}
          <div dangerouslySetInnerHTML={{ __html: topic.content }} />
        </div>
      </article>
    </div>
  );
}
