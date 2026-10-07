<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    ArrowRightIcon,
    CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import TemplateScrollPicker from '@/components/SelectFrame/TemplateScrollPicker.vue'
import { useEditorTemplates, type Template } from '@/composables/useEditor'

/* =========================================================
   Route
   ========================================================= */
const route = useRoute()
const router = useRouter()
const sessionId = computed(() => route.params.sessionId as string)

/* =========================================================
   Fetch templates
   ========================================================= */
const { data: templatesData, isLoading: templatesLoading } =
    useEditorTemplates(sessionId)

const templates = computed<Template[]>(() => templatesData.value ?? [])

/* =========================================================
   State
   ========================================================= */
const selectedTemplateId = ref<string | null>(null)

// auto-select pertama kali templates load
watch(templates, (list) => {
    if (!selectedTemplateId.value && list.length > 0) {
        selectedTemplateId.value = list[0].id
    }
})

const selectedTemplate = computed(
    () =>
        templates.value.find((t) => t.id === selectedTemplateId.value) ??
        null
)

const canProceed = computed(() => !!selectedTemplate.value)

/* =========================================================
   Go Next
   ========================================================= */
function goNext() {
    if (!canProceed.value) return
    router.push({
        name: 'capture',
        params: { sessionId: sessionId.value, templateId: selectedTemplateId.value },
    })
}
</script>

<template>
    <div class="relative flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink">
        <main class="flex min-h-0 flex-1 flex-col gap-5 p-4 sm:p-6">

            <!-- ============ Header ============ -->
            <header class="shrink-0">
                <p class="eyebrow text-ink/50">Pilih Frame</p>
                <h1 class="display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    Pilih template favoritmu
                </h1>
            </header>

            <!-- ============ Scroll horizontal template ============ -->
            <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
                <TemplateScrollPicker :templates="templates" :selected-id="selectedTemplateId"
                    :loading="templatesLoading" @select="selectedTemplateId = $event" />
            </div>

            <!-- ============ Footer info + Lanjut ============ -->
            <footer class="flex shrink-0 flex-col gap-4">
                <!-- Info bar -->
                <div class="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]" :class="selectedTemplate
                    ? 'border-2 border-blue bg-blue/10 text-ink'
                    : 'border-2 border-dashed border-ink/30 text-ink/55'
                    ">
                    <template v-if="selectedTemplate">
                        <span class="display font-bold text-blue">
                            {{ selectedTemplate.name }}
                        </span>
                        <span class="text-ink/70">
                            {{ selectedTemplate.dropzones?.length ?? 0 }} frame ·
                            {{ selectedTemplate.size?.width }}×{{ selectedTemplate.size?.height }}
                        </span>
                    </template>
                    <template v-else>
                        <span>Pilih salah satu template di atas untuk lanjut</span>
                    </template>
                </div>

                <!-- Tombol Lanjut -->
                <button type="button"
                    class="display inline-flex w-full items-center justify-center gap-4 border-4 border-ink bg-lime px-8 py-4 text-2xl font-bold text-ink shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-40 sm:text-3xl"
                    :disabled="!canProceed" @click="goNext">
                    <span class="tracking-[-.02em]">Lanjut</span>
                    <ArrowRightIcon class="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
                </button>
            </footer>
        </main>
    </div>
</template>