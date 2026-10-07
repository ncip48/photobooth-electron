<template>
    <div class="fade-in mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <!-- Eyebrow skeleton -->
        <div
            class="slide-in-down mb-8 inline-flex items-center gap-3 border border-lime/20 bg-ink/40 px-4 py-2 backdrop-blur-md">
            <div class="h-2 w-2 animate-pulse rounded-full bg-lime/40" />
            <div class="h-3 w-32 animate-pulse bg-white/15" />
        </div>

        <!-- Title skeleton (2 baris) -->
        <div class="space-y-4">
            <div class="h-14 w-[min(90vw,700px)] animate-pulse bg-white/10 sm:h-16 lg:h-20" />
            <div class="h-14 w-[min(70vw,500px)] animate-pulse bg-white/8 sm:h-16 lg:h-20 mx-auto" />
        </div>

        <!-- Divider skeleton -->
        <div class="mt-8 flex items-center gap-3 opacity-40" aria-hidden="true">
            <span class="h-px w-12 bg-lime/30 sm:w-20" />
            <span class="h-1.5 w-1.5 rotate-45 bg-lime/40" />
            <span class="h-px w-12 bg-lime/30 sm:w-20" />
        </div>

        <!-- Subtitle skeleton -->
        <div class="mt-8 w-full max-w-3xl space-y-3">
            <div class="mx-auto h-5 w-full animate-pulse bg-white/8 sm:h-6" />
            <div class="mx-auto h-5 w-3/4 animate-pulse bg-white/6 sm:h-6" />
        </div>

        <!-- Button skeleton -->
        <div class="slide-in-up mt-20 w-full max-w-md">
            <div class="h-24 w-full animate-pulse border-4 border-white/10 bg-white/5 sm:h-28" />
        </div>
    </div>
</template>