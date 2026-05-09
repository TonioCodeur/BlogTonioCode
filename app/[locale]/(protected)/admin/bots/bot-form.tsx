"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";

import { useI18n } from "@/locales/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
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

import { createBot, updateBot } from "@/lib/actions/bots";
import { createBotSchema, updateBotSchema } from "@/lib/validations/bots";
import type { BotDetail } from "@/lib/bots-types";

const ROLES = ["USER", "CUSTOMER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

type CreateValues = z.infer<typeof createBotSchema>;
type UpdateValues = z.infer<typeof updateBotSchema>;

type Props =
  | { mode: "create"; bot?: undefined }
  | { mode: "update"; bot: BotDetail };

export function BotForm(props: Props) {
  const t = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const isUpdate = props.mode === "update";

  const defaultValues: CreateValues = {
    email: props.bot?.email ?? "",
    name: props.bot?.name ?? "",
    image: props.bot?.image ?? "",
    role: (props.bot?.role as CreateValues["role"]) ?? "USER",
    botDescription: props.bot?.botDescription ?? "",
    isBotActive: props.bot?.isBotActive ?? true,
  };

  // Both schemas accept the same body fields (update has them all optional);
  // the form always collects full values, so we validate against createBotSchema
  // on submit and let the server re-validate against updateBotSchema when
  // updating. This keeps a single `useForm<CreateValues>` type.
  void updateBotSchema;
  const form = useForm<CreateValues>({
    resolver: zodResolver(createBotSchema),
    defaultValues,
  });

  async function onSubmit(values: CreateValues) {
    setSubmitting(true);
    try {
      // Normalise empty strings to undefined for optional fields.
      const payload = {
        ...values,
        image: values.image?.trim() ? values.image.trim() : undefined,
        botDescription: values.botDescription?.trim()
          ? values.botDescription.trim()
          : undefined,
      };

      const result = isUpdate
        ? await updateBot({ ...(payload as UpdateValues), id: props.bot.id })
        : await createBot(payload);

      if (result.ok) {
        toast.success(
          isUpdate
            ? t("admin.bots.toasts.updated")
            : t("admin.bots.toasts.created")
        );
        router.push("/admin/bots");
        router.refresh();
      } else {
        toast.error(t(result.errorKey as Parameters<typeof t>[0]));
      }
    } catch {
      toast.error(t("admin.bots.errors.unknown"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        aria-label={t("admin.bots.detail.infoSection")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.bots.form.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="off"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.bots.form.name")}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.bots.form.image")}</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    autoComplete="off"
                    placeholder="https://..."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.bots.form.role")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? "USER"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="botDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.bots.form.description")}</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isBotActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
              <FormLabel className="m-0">{t("admin.bots.form.active")}</FormLabel>
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                  aria-label={t("admin.bots.form.active")}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? t("admin.bots.form.submit.saving")
              : isUpdate
                ? t("admin.bots.form.submit.update")
                : t("admin.bots.form.submit.create")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
