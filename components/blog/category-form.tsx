"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createCategory } from "@/lib/actions/blog";
import { useI18n } from "@/locales/client";
import { queryKeys } from "@/lib/queries";

export function CategoryForm() {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (result) => {
      if (result.success && result.data) {
        toast.success(t("category.new.success"));
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
        router.push(`/categories/${result.data.slug}`);
        router.refresh();
      } else {
        toast.error(
          (!result.success && result.error) || t("category.new.error"),
        );
      }
    },
    onError: () => toast.error(t("category.new.error")),
  });

  const schema = z.object({
    name: z
      .string()
      .min(1, t("category.new.validation.nameRequired"))
      .max(50, t("category.new.validation.nameTooLong")),
    description: z.string().max(500).optional().or(z.literal("")),
    color: z.string().optional().or(z.literal("")),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      color: "#6366f1",
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      name: values.name,
      description: values.description || undefined,
      color: values.color || undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category.new.fields.name")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("category.new.fields.namePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category.new.fields.description")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("category.new.fields.descriptionPlaceholder")}
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category.new.fields.color")}</FormLabel>
              <FormControl>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    className="h-10 w-20 cursor-pointer p-1"
                    {...field}
                  />
                  <Input
                    type="text"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="#6366f1"
                    className="font-mono"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t("category.new.submitting")
              : t("category.new.submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
