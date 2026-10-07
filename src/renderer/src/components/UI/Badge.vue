<script setup>
import { computed } from 'vue'

const props = defineProps({
    tone: {
        type: String,
        default: 'grey',
        validator: (v) =>
            ['grey', 'ink', 'blue', 'lime', 'amber', 'rose', 'paper'].includes(v),
    },
    size: {
        type: String,
        default: 'md',
        validator: (v) => ['sm', 'md', 'lg'].includes(v),
    },
    dot: { type: Boolean, default: false },
})

const toneClasses = {
    grey: 'bg-grey text-ink border-ink',
    ink: 'bg-ink text-white border-ink',
    blue: 'bg-blue text-white border-blue',
    lime: 'bg-lime text-ink border-ink',
    amber: 'bg-amber text-ink border-ink',
    rose: 'bg-rose text-ink border-ink',
    paper: 'bg-paper-soft text-ink border-ink',
}

const sizeClasses = {
    sm: 'px-2 py-[2px] text-[10px]',
    md: 'px-2.5 py-[3px] text-[10.5px]',
    lg: 'px-3 py-1 text-[11.5px]',
}

const classes = computed(() => [
    'inline-flex items-center gap-1.5 rounded-full border-[1.5px] font-display font-bold whitespace-nowrap',
    toneClasses[props.tone] || toneClasses.grey,
    sizeClasses[props.size] || sizeClasses.md,
])

const dotColor = computed(() => {
    const map = {
        grey: 'bg-ink/40',
        ink: 'bg-lime',
        blue: 'bg-white',
        lime: 'bg-ink/70',
        amber: 'bg-ink/70',
        rose: 'bg-ink/70',
        paper: 'bg-ink/60',
    }
    return map[props.tone] || 'bg-ink/40'
})
</script>

<template>
    <span :class="classes">
        <span v-if="dot" class="inline-block h-1.5 w-1.5 rounded-full" :class="dotColor" aria-hidden="true" />
        <slot />
    </span>
</template>
