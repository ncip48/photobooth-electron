<template>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <div v-for="i in 10" :key="i" class="aspect-[3/4] animate-pulse border-2 border-ink bg-ink/10" />
    </div>
</template>