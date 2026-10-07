<script setup lang="ts">
import { ClockIcon } from '@heroicons/vue/24/outline'

withDefaults(
    defineProps<{
        mmss?: string
        isExpired?: boolean
        isLowTime?: boolean
        loading?: boolean
    }>(),
    {
        mmss: '00:00',
        isExpired: false,
        isLowTime: false,
        loading: false,
    }
)
</script>

<template>
    <div class="pointer-events-none z-40 ">
        <div class="pointer-events-auto flex items-center gap-2.5 border-2 px-4 py-2.5 shadow-brutal-sm transition-colors"
            :class="loading
                ? 'border-ink/20 bg-paper-soft'
                : isExpired
                    ? 'border-[#b3261e] bg-rose'
                    : isLowTime
                        ? 'border-ink bg-amber'
                        : 'border-ink bg-paper-soft'
                ">
            <template v-if="loading">
                <span class="inline-block h-5 w-16 animate-pulse bg-ink/10" />
            </template>
            <template v-else>
                <ClockIcon class="h-4 w-4 shrink-0" :class="isLowTime && !isExpired
                    ? 'animate-pulse text-ink'
                    : 'text-ink/60'
                    " />
                <span class="display text-xl font-bold leading-none tracking-tight tabular-nums text-ink">
                    {{ mmss }}
                </span>
            </template>
        </div>
    </div>
</template>