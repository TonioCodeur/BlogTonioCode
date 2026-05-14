"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "@/components/markdown-editor";
import { createPost } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";

type CategoryOption = {
  slug: string;
  name: string;
};

type PostFormProps = {
  categories: CategoryOption[];
};

export function PostForm({ categories }: PostFormProps) {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: (result) => {
      if (result.success && result.data) {
        toast.success(t("blog.new.success"));
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
        router.push(`/blog/${result.data.slug}`);
        router.refresh();
      } else {
        toast.error(
          (!result.success && result.error) || t("blog.new.error"),
        );
      }
    },
    onError: () => toast.error(t("blog.new.error")),
  });

  const schema = z.object({
    title: z
      .string()
      .min(1, t("blog.new.validation.titleRequired"))
      .max(200, t("blog.new.validation.titleTooLong")),
    excerpt: z.string().max(500).optional().or(z.literal("")),
    content: z.string().min(1, t("blog.new.validation.contentRequired")),
    coverImage: z
      .string()
      .url(t("blog.new.validation.coverInvalid"))
      .optional()
      .or(z.literal("")),
    categorySlug: z.string().min(1, t("blog.new.validation.categoryRequired")),
    published: z.boolean(),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      excerpt: "",
      content: "",
      coverImage: "",
      categorySlug: "",
      published: true,
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      title: values.title,
      excerpt: values.excerpt || undefined,
      content: values.content,
      coverImage: values.coverImage || undefined,
      categorySlug: values.categorySlug,
      published: values.published,
    });
  };

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="text-muted-foreground">{t("blog.new.noCategories")}</p>
        <Button asChild className="mt-4">
          <Link href="/categories/new">{t("blog.new.createCategory")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("blog.new.fields.title")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("blog.new.fields.titlePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="excerpt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("blog.new.fields.excerpt")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("blog.new.fields.excerptPlaceholder")}
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categorySlug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("blog.new.fields.category")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("blog.new.fields.categoryPlaceholder")}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="coverImage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("blog.new.fields.cover")}</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder={t("blog.new.fields.coverPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("blog.new.fields.content")}</FormLabel>
              <FormControl>
                <MarkdownEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("blog.new.fields.contentPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="published"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>{t("blog.new.fields.published")}</FormLabel>
                <FormDescription>
                  {t("blog.new.fields.publishedDescription")}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("blog.new.submitting") : t("blog.new.submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
