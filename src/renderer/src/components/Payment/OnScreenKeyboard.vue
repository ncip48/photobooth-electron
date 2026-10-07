<script setup lang="ts">
import {
    BackspaceIcon,
    ArrowUturnLeftIcon,
} from '@heroicons/vue/24/outline'

const props = withDefaults(
    defineProps<{
        modelValue?: string
        maxLength?: number
        disabled?: boolean
    }>(),
    {
        modelValue: '',
        maxLength: 12,
        disabled: false,
    }
)

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'submit'): void
}>()

const rows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '-'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '_'],
]

const pressKey = (key: string) => {
    if (props.disabled) return
    if (props.modelValue.length >= props.maxLength) return
    emit('update:modelValue', props.modelValue + key)
}

const backspace = () => {
    if (props.disabled) return
    emit('update:modelValue', props.modelValue.slice(0, -1))
}

const clear = () => {
    if (props.disabled) return
    emit('update:modelValue', '')
}

const submit = () => {
    if (props.disabled) return
    emit('submit')
}
</script>

<template>
    <div class="space-y-2.5">
        <!-- Row 1-4 -->
        <div v-for="(row, rowIdx) in rows" :key="rowIdx" class="flex justify-center gap-1.5 sm:gap-2">
            <button v-for="key in row" :key="key" type="button"
                class="display flex h-14 min-w-[52px] flex-1 items-center justify-center border-2 border-ink bg-paper-soft text-lg font-bold text-ink transition-all active:translate-y-0.5 active:bg-lime disabled:cursor-not-allowed disabled:opacity-50 sm:h-16 sm:min-w-[60px] sm:text-xl"
                :disabled="disabled" @click="pressKey(key)">
                {{ key }}
            </button>
        </div>

        <!-- Action keys -->
        <div class="flex justify-center gap-2">
            <button type="button"
                class="display flex h-14 min-w-[100px] flex-1 items-center justify-center gap-2 border-2 border-ink bg-amber text-base font-bold text-ink transition-all active:translate-y-0.5 active:bg-amber/80 disabled:cursor-not-allowed disabled:opacity-50 sm:h-16"
                :disabled="disabled" @click="clear">
                <ArrowUturnLeftIcon class="h-5 w-5" />
                Clear
            </button>

            <button type="button"
                class="display flex h-14 min-w-[100px] flex-1 items-center justify-center gap-2 border-2 border-ink bg-paper-soft text-base font-bold text-ink transition-all active:translate-y-0.5 active:bg-lime disabled:cursor-not-allowed disabled:opacity-50 sm:h-16"
                :disabled="disabled" @click="backspace">
                <BackspaceIcon class="h-5 w-5" />
                Hapus
            </button>

            <button type="button"
                class="display flex h-14 min-w-[140px] flex-[2] items-center justify-center gap-2 border-2 border-ink bg-lime text-base font-bold text-ink transition-all active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:h-16"
                :disabled="disabled || !modelValue" @click="submit">
                Gunakan Voucher
            </button>
        </div>
    </div>
</template>