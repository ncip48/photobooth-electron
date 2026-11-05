import { computed, type Ref } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { photoboothApi } from "@/lib/api";
import { Template } from "./useEditor";

export interface CaptureItem {
  id: string;
  filename: string;
  url: string;
  thumbnail_url?: string | null;
  uploading?: boolean;
  failed?: boolean;
  error?: string;
  created_at?: string;
}

/* =========================================================
   Helpers
   ========================================================= */

const getValue = <T>(value: Ref<T> | T): T => {
  return typeof value === "object" && value !== null && "value" in value
    ? value.value
    : value;
};

const queryKey = (sessionId: Ref<string> | string) => {
  const id = getValue(sessionId);
  return ["photobooth", "captures", id];
};

/* =========================================================
   Fetch captures
   ========================================================= */

export function useCaptures(
  sessionId: Ref<string> | string,
  templateId?: Ref<string> | string | null,
) {
  const queryClient = useQueryClient();
  const key = queryKey(sessionId);

  /* ---------- Query: fetch captures ---------- */

  const query = useQuery({
    queryKey: key,

    queryFn: async () => {
      const id = getValue(sessionId);

      const res = await photoboothApi.listCaptures(id);

      if (!res.success) {
        throw new Error("Gagal memuat captures.");
      }

      return res.captures as CaptureItem[];
    },

    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  /* ---------- Helper: update cache ---------- */

  function updateCache(updater: (items: CaptureItem[]) => CaptureItem[]) {
    queryClient.setQueryData<CaptureItem[]>(key, (old = []) => updater(old));
  }

  /* =========================================================
       Upload
       ========================================================= */

  async function uploadCapture(
    base64: string,
    mimeType = "image/jpeg",
    tempId?: string,
    replaceTarget?: {
      item: CaptureItem;
      index: number;
    },
  ) {
    const id = getValue(sessionId);
    const actualTempId = tempId ?? `temp-${Date.now()}`;
    const originalItem = replaceTarget?.item;

    const tempPhoto: CaptureItem = {
      id: actualTempId,
      filename: `capture-${Date.now()}.jpg`,
      url: base64,
      uploading: true,
      failed: false,
      created_at: new Date().toISOString(),
    };

    // Optimistic update:
    // Retake mengganti sementara item pada slot yang sama.
    // Capture biasa tetap menambahkan item baru.
    updateCache((items) => {
      if (originalItem) {
        return items.map((item) =>
          item.id === originalItem.id ? tempPhoto : item,
        );
      }

      return [...items, tempPhoto];
    });

    try {
      const res = originalItem
        ? await photoboothApi.replaceCapture(
            id,
            originalItem.id,
            base64,
            mimeType,
          )
        : await photoboothApi.uploadCapture(id, base64, mimeType);

      if (!res.success) {
        throw new Error(res.error ?? "Upload gagal.");
      }

      const serverPhoto: CaptureItem = {
        id: res.capture.id,
        filename: res.capture.filename,
        url: res.capture.url,
        uploading: false,
        failed: false,
        created_at: res.capture.created_at ?? new Date().toISOString(),
      };

      updateCache((items) =>
        items.map((item) => (item.id === actualTempId ? serverPhoto : item)),
      );

      return res.capture;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Upload gagal.";

      updateCache((items) => {
        if (originalItem) {
          // Upload retake gagal: pulihkan foto lama.
          return items.map((item) =>
            item.id === actualTempId ? originalItem : item,
          );
        }

        return items.map((item) =>
          item.id === actualTempId
            ? {
                ...item,
                uploading: false,
                failed: true,
                error: errorMessage,
              }
            : item,
        );
      });

      throw err;
    }
  }

  /* =========================================================
       Delete
       ========================================================= */

  const deleteMutation = useMutation({
    mutationFn: async (galleryId: string) => {
      const id = getValue(sessionId);

      const res = await photoboothApi.deleteCapture(id, galleryId);

      if (!res.success) {
        throw new Error("Gagal menghapus.");
      }

      return galleryId;
    },

    onSuccess: (galleryId) => {
      updateCache((items) => items.filter((item) => item.id !== galleryId));
    },
  });

  const deleteCapture = (galleryId: string) => {
    return deleteMutation.mutateAsync(galleryId);
  };

  /* =========================================================
       Finish
       ========================================================= */

  const finishMutation = useMutation({
    mutationFn: async () => {
      const id = getValue(sessionId);

      return photoboothApi.finishCapture(id);
    },
  });

  const finishCapture = () => {
    return finishMutation.mutateAsync();
  };

  /* =========================================================
       Template
       ========================================================= */

  const templateQuery = useQuery({
    queryKey: computed(() => [
      "photobooth",
      "template",
      getValue(sessionId),
      getValue(templateId ?? null),
    ]),

    enabled: computed(() => {
      return Boolean(getValue(sessionId) && getValue(templateId ?? null));
    }),

    queryFn: async () => {
      const sId = getValue(sessionId);
      const tId = getValue(templateId ?? null);

      if (!tId) {
        throw new Error("Template ID tidak tersedia.");
      }

      const res = await photoboothApi.getTemplate(sId, tId);

      if (!res.success) {
        throw new Error("Gagal memuat template.");
      }

      return res.template as Template;
    },
  });

  /* =========================================================
       Computed
       ========================================================= */

  const captures = computed(() => query.data.value ?? []);

  const totalCaptures = computed(() => captures.value.length);

  const hasPendingUploads = computed(() =>
    captures.value.some((capture) => capture.uploading),
  );

  const totalDropzone = computed(() => {
    const template = templateQuery.data.value;

    if (!template) {
      return 0;
    }

    return template.dropzones.length ?? 0;
  });

  /* =========================================================
       Return
       ========================================================= */

  return {
    // State
    captures,
    totalCaptures,
    hasPendingUploads,
    totalDropzone,

    isLoading: computed(() => query.isLoading.value),

    isError: computed(() => query.isError.value),

    error: computed(() => query.error.value),

    // Template
    template: computed(() => templateQuery.data.value ?? null),

    isTemplateLoading: computed(() => templateQuery.isLoading.value),

    // Actions
    uploadCapture,
    deleteCapture,
    finishCapture,

    // Deleting state
    deletingId: computed(() => deleteMutation.variables.value ?? null),

    isDeleting: computed(() => deleteMutation.isPending.value),

    // Finish state
    isFinishing: computed(() => finishMutation.isPending.value),

    // Refetch
    refetch: query.refetch,

    // Template refetch
    refetchTemplate: templateQuery.refetch,
  };
}
