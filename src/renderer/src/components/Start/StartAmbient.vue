<script setup lang="ts">
defineProps<{
    backgroundUrl?: string | null
}>()
</script>

<template>
    <div class="absolute inset-0 z-0 overflow-hidden">
        <!-- Base image / pattern -->
        <img v-if="backgroundUrl" :src="backgroundUrl" alt="" class="h-full w-full scale-110 object-cover" />
        <div v-else class="grid-pattern h-full w-full bg-ink" />

        <!-- Ambient color blobs -->
        <div class="ambient-float-slow pointer-events-none absolute -left-[20%] -top-[20%] h-[70vh] w-[70vh] rounded-full bg-lime/20 blur-[120px]"
            aria-hidden="true" />
        <div class="ambient-float-mid pointer-events-none absolute -right-[15%] top-[10%] h-[60vh] w-[60vh] rounded-full bg-blue/25 blur-[140px]"
            aria-hidden="true" />
        <div class="ambient-float-fast pointer-events-none absolute bottom-[-15%] left-[20%] h-[50vh] w-[50vh] rounded-full bg-lime/15 blur-[100px]"
            aria-hidden="true" />

        <!-- Vignette -->
        <div class="absolute inset-0 backdrop-blur-[3px]" style="
                background: radial-gradient(
                    ellipse at center,
                    rgba(32, 32, 30, 0.35) 0%,
                    rgba(32, 32, 30, 0.75) 55%,
                    rgba(32, 32, 30, 0.98) 100%
                );
            " aria-hidden="true" />

        <!-- Top + bottom gradient -->
        <div class="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-ink/90 via-ink/40 to-transparent"
            aria-hidden="true" />
        <div class="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink via-ink/60 to-transparent"
            aria-hidden="true" />

        <!-- Grain -->
        <div class="grain-overlay pointer-events-none absolute -inset-[5%] opacity-[0.05] mix-blend-overlay" style="
                background-image: radial-gradient(rgba(255, 255, 255, 0.6) 1px, transparent 1px);
                background-size: 3px 3px;
            " aria-hidden="true" />
    </div>
</template>