<script setup lang="ts">
import { Squares2X2Icon } from '@heroicons/vue/24/outline'

interface Dropzone {
    id: string
    top: number
    left: number
    width: number
    height: number
}

interface Template {
    id: string
    name: string
    type: string
    location_url: string | null
    size: { width: number; height: number }
    dropzones: Dropzone[]
}

withDefaults(
    defineProps < {
        templates: Template[]
        selectedId?: string | null
        loading?: boolean
    } > (),
    {
        selectedId: null,
        loading: false,
    }
)

const emit = defineEmits < {
    (e: 'select', templateId: string): void
}> ()
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header class="flex shrink-0 items-center gap-2.5 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                <Squares2X2Icon class="h-4 w-4 text-ink" />
            </span>
            <div class="min-w-0 flex-1">
                <p class="eyebrow text-ink/50">Template</p>
                <p class="display text-[13.5px] font-bold text-ink" :class="loading && 'text-ink/40'">
                    <template v-if="loading">
                        <span class="inline-block h-3 w-16 animate-pulse bg-ink/10" />
                    </template>
                    <template v-else>
                        {{ templates.length }} tersedia
                    </template>
                </p>
            </div>
        </header>

        <!-- Body -->
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <!-- ============================================================
                 SKELETON LOADING
                 ============================================================ -->
            <div v-if="loading" class="space-y-3">
                <div v-for="i in 3" :key="i" class="overflow-hidden border-2 border-ink/20 bg-paper-soft">
                    <!-- Preview skeleton -->
                    <div class="relative animate-pulse bg-ink/10" style="aspect-ratio: 3/4">
                        <!-- Badge skeleton -->
                        <div class="absolute left-2 top-2 h-5 w-10 border-2 border-ink/10 bg-paper-soft/50" />
                    </div>

                    <!-- Info skeleton -->
                    <div class="space-y-2 border-t-2 border-ink/10 px-3 py-2.5">
                        <div class="h-3 w-3/4 animate-pulse bg-ink/10" />
                        <div class="flex items-center justify-between">
                            <div class="h-2.5 w-12 animate-pulse bg-ink/10" />
                            <div class="h-2.5 w-16 animate-pulse bg-ink/10" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 EMPTY STATE
                 ============================================================ -->
            <div v-else-if="templates.length === 0" class="grid h-full place-items-center px-4 py-10 text-center">
                <div>
                    <span class="mx-auto grid h-14 w-14 place-items-center border-2 border-ink bg-paper">
                        <Squares2X2Icon class="h-6 w-6 text-ink/30" />
                    </span>
                    <p class="display mt-3 text-[13px] font-bold text-ink/60">
                        Belum ada template
                    </p>
                    <p class="mt-1 text-[12px] text-ink/45">
                        Template untuk event ini belum tersedia
                    </p>
                </div>
            </div>

            <!-- ============================================================
                 TEMPLATE LIST
                 ============================================================ -->
            <div v-else class="space-y-3">
                <button v-for="tpl in templates" :key="tpl.id" type="button"
                    class="group block w-full overflow-hidden border-2 bg-paper-soft text-left transition-all" :class="selectedId === tpl.id
                            ? 'border-blue ring-4 ring-blue/30'
                            : 'border-ink hover:-translate-y-0.5'
                        " @click="emit('select', tpl.id)">
                    <!-- Preview -->
                    <div class="relative bg-paper" style="aspect-ratio: 3/4">
                        <img v-if="tpl.location_url" :src="tpl.location_url" :alt="tpl.name"
                            class="absolute inset-0 h-full w-full object-cover" />
                        <div v-else class="grid-pattern absolute inset-0" />

                        <!-- Selected badge -->
                        <div v-if="selectedId === tpl.id"
                            class="display absolute right-2 top-2 border-2 border-ink bg-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                            Aktif
                        </div>

                        <!-- Type badge -->
                        <div
                            class="display absolute left-2 top-2 border-2 border-ink bg-paper-soft px-2 py-0.5 text-[10px] font-bold text-ink">
                            {{ tpl.type }}
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="border-t-2 border-ink px-3 py-2.5">
                        <p class="display line-clamp-1 text-[13px] font-bold text-ink">
                            {{ tpl.name }}
                        </p>
                        <p class="mt-0.5 flex items-center justify-between text-[10.5px] text-ink/55">
                            <span>{{ tpl.dropzones?.length ?? 0 }} frame</span>
                            <span class="tabular-nums">
                                {{ tpl.size?.width }}×{{ tpl.size?.height }}
                            </span>
                        </p>
                    </div>
                </button>
            </div>
        </div>
    </div>
</template>