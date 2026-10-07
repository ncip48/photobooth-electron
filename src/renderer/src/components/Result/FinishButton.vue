<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/24/outline'

withDefaults(
    defineProps<{
        loading?: boolean
        disabled?: boolean
    }>(),
    {
        loading: false,
        disabled: false,
    }
)

const emit = defineEmits<{
    (e: 'click'): void
}>()
</script>

<template>
    <button type="button"
        class="display inline-flex w-full shrink-0 items-center justify-center gap-3 border-4 border-ink bg-ink px-8 py-4 text-xl font-bold text-white shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50 sm:text-2xl"
        :disabled="loading || disabled" @click="emit('click')">
        <CheckCircleIcon class="h-6 w-6 shrink-0 sm:h-7 sm:w-7" :class="loading && 'animate-pulse'" />
        <span class="tracking-[-.02em]">
            {{ loading ? 'Menyimpan...' : 'Selesai' }}
        </span>
    </button>
</template>