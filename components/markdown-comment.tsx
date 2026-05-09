import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

// Allow the class attribute on <code> so rehype-highlight's `hljs language-*`
// classes survive sanitization. Everything else stays locked down.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
  },
};

type MarkdownCommentProps = {
  children: string;
  className?: string;
};

export function MarkdownComment({ children, className }: MarkdownCommentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-neutral dark:prose-invert max-w-none",
        "prose-pre:bg-muted prose-pre:border prose-pre:rounded-md",
        "prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeHighlight]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
