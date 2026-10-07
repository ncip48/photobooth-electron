<script setup>
import { computed } from 'vue'

const props = defineProps({
    placement: { type: Object, required: true },
    photo: { type: Object, default: null },
})

const emit = defineEmits(['update', 'remove'])

const transform = computed(() =>
    props.placement?.transform ?? { scale: 1, rotate: 0, x: 0, y: 0 }
)

/* Setiap update HARUS kirim transform lengkap */
const update = (patch) => {
    emit('update', { ...transform.value, ...patch })
}

const reset = () => emit('update', { scale: 1, rotate: 0, x: 0, y: 0 })

const scalePercent = computed({
    get: () => Math.round(transform.value.scale * 100),
    set: (val) => update({ scale: Math.max(0.1, Math.min(3, Number(val) / 100)) }),
})

const rotation = computed({
    get: () => Math.round(transform.value.rotate),
    set: (val) => update({ rotate: Number(val) }),
})
</script>

<template>
    <div class="flex flex-col">
        <!-- Header -->
        <header class="flex items-center gap-2.5 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-blue text-white">
                <PhotoIcon class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
                <p class="eyebrow text-ink/50">Edit Foto</p>
                <p class="display truncate text-[13px] font-bold text-ink">
                    {{ photo?.filename ?? '—' }}
                </p>
            </div>
        </header>

        <!-- Body -->
        <div class="space-y-4 p-4">
            <!-- Zoom -->
            <div>
                <div class="mb-1.5 flex items-center justify-between">
                    <label class="eyebrow flex items-center gap-1.5 text-ink/60">
                        <ArrowsPointingOutIcon class="h-3.5 w-3.5" />
                        Zoom
                    </label>
                    <span class="display text-[11.5px] font-bold tabular-nums text-ink">
                        {{ scalePercent }}%
                    </span>
                </div>
                <input v-model.number="scalePercent" type="range" min="10" max="300" step="5"
                    class="range-input w-full" />
            </div>

            <!-- Rotate -->
            <div>
                <div class="mb-1.5 flex items-center justify-between">
                    <label class="eyebrow flex items-center gap-1.5 text-ink/60">
                        <ArrowPathIcon class="h-3.5 w-3.5" />
                        Rotasi
                    </label>
                    <span class="display text-[11.5px] font-bold tabular-nums text-ink">
                        {{ rotation }}°
                    </span>
                </div>
                <input v-model.number="rotation" type="range" min="-180" max="180" step="1"
                    class="range-input w-full" />
            </div>

            <!-- Position X -->
            <div>
                <div class="mb-1.5 flex items-center justify-between">
                    <label class="eyebrow flex items-center gap-1.5 text-ink/60">
                        <ArrowsRightLeftIcon class="h-3.5 w-3.5" />
                        Geser X
                    </label>
                    <span class="display text-[11.5px] font-bold tabular-nums text-ink">
                        {{ Math.round(transform.x) }}px
                    </span>
                </div>
                <input :value="transform.x" type="range" min="-500" max="500" step="1" class="range-input w-full"
                    @input="(e) => update({ x: Number(e.target.value) })" />
            </div>

            <!-- Position Y -->
            <div>
                <div class="mb-1.5 flex items-center justify-between">
                    <label class="eyebrow flex items-center gap-1.5 text-ink/60">
                        <ArrowsUpDownIcon class="h-3.5 w-3.5" />
                        Geser Y
                    </label>
                    <span class="display text-[11.5px] font-bold tabular-nums text-ink">
                        {{ Math.round(transform.y) }}px
                    </span>
                </div>
                <input :value="transform.y" type="range" min="-500" max="500" step="1" class="range-input w-full"
                    @input="(e) => update({ y: Number(e.target.value) })" />
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-2 border-t-2 border-ink pt-4">
                <button type="button"
                    class="display inline-flex items-center justify-center gap-2 border-2 border-ink bg-paper-soft px-3 py-2.5 text-[12.5px] font-bold text-ink transition-all active:translate-y-0.5 hover:bg-lime"
                    @click="reset">
                    <ArrowUturnLeftIcon class="h-4 w-4" />
                    Reset Transform
                </button>

                <button type="button"
                    class="display inline-flex items-center justify-center gap-2 border-2 border-ink bg-rose px-3 py-2.5 text-[12.5px] font-bold text-ink transition-all active:translate-y-0.5 hover:bg-[#b3261e] hover:text-white"
                    @click="emit('remove')">
                    <TrashIcon class="h-4 w-4" />
                    Hapus dari Frame
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Range input custom — brutalist */
.range-input {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    background: #fffdf8;
    border: 2px solid #20201e;
    cursor: pointer;
}

.range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 18px;
    width: 18px;
    background: #d9ed93;
    border: 2px solid #20201e;
    cursor: grab;
}

.range-input::-webkit-slider-thumb:active {
    cursor: grabbing;
    background: #2945e8;
}

.range-input::-moz-range-thumb {
    height: 18px;
    width: 18px;
    background: #d9ed93;
    border: 2px solid #20201e;
    border-radius: 0;
    cursor: grab;
}
</style>
