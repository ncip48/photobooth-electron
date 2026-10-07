<template>
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="card flex animate-pulse flex-col overflow-hidden">
            <!-- Thumbnail -->
            <div class="h-40 border-b-2 border-ink/10 bg-ink/10" />

            <!-- Info -->
            <div class="flex flex-1 flex-col gap-3 p-4">
                <div class="h-4 w-3/4 bg-ink/10" />
                <div class="h-3 w-full bg-ink/8" />
                <div class="h-3 w-2/3 bg-ink/8" />
                <div class="mt-auto h-3 w-1/3 bg-ink/10" />
            </div>
        </div>
    </div>
</template>