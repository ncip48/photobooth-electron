<script setup lang="ts">
import { ClockIcon } from '@heroicons/vue/24/outline'

withDefaults(
    defineProps<{
        mmss: string
        isExpired?: boolean
        isLowTime?: boolean
        loading?: boolean
    }>(),
    {
        isExpired: false,
        isLowTime: false,
        loading: false,
    }
)
</script>

<template>
    <div class="flex shrink-0 items-center gap-2 border-2 px-3 py-1.5 transition-colors" :class="loading
        ? 'border-ink/20 bg-paper'
        : isExpired
            ? 'border-[#b3261e] bg-rose'
            : isLowTime
                ? 'border-ink bg-amber'
                : 'border-ink bg-paper'
        ">
        <template v-if="loading">
            <span class="inline-block h-4 w-14 animate-pulse bg-ink/10" />
        </template>
        <template v-else>
            <ClockIcon class="h-3.5 w-3.5 shrink-0" :class="isLowTime && !isExpired
                ? 'animate-pulse text-ink'
                : 'text-ink/60'
                " />
            <span class="display text-base font-bold leading-none tracking-tight tabular-nums text-ink sm:text-lg">
                {{ mmss }}
            </span>
        </template>
    </div>
</template>