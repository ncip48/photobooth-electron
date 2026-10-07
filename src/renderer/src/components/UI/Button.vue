<script setup>
import { computed, useAttrs } from 'vue'

const props = defineProps({
    type: { type: String, default: 'button' },
    variant: {
        type: String,
        default: 'primary',
        validator: (v) => ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success', 'ink', 'lime', 'paper'].includes(v),
    },
    size: {
        type: String,
        default: 'md',
        validator: (v) => ['sm', 'md', 'lg'].includes(v),
    },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    icon: { type: Object, default: null },
    iconPosition: { type: String, default: 'left' },
    fullWidth: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])
const attrs = useAttrs()

const variantClasses = {
    primary: 'btn-blue',
    secondary: 'btn-ink',
    ink: 'btn-ink',
    lime: 'btn-lime',
    paper: 'btn-paper',
    outline: 'bg-paper-soft text-ink',
    ghost: 'border-transparent shadow-none text-ink/70 hover:bg-ink/5 hover:shadow-none',
    danger: 'bg-[#ffb3ab] text-ink',
    success: 'bg-lime text-ink',
}

const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'min-h-[50px] px-6 text-sm',
}

const classes = computed(() => [
    'btn',
    variantClasses[props.variant] || variantClasses.primary,
    sizeClasses[props.size] || '',
    (props.disabled || props.loading) ? 'cursor-not-allowed opacity-60 !transform-none !shadow-brutal-sm' : '',
    props.fullWidth ? 'w-full' : '',
    attrs.class,
])

const handleClick = (event) => {
    if (!props.disabled && !props.loading) emit('click', event)
}
</script>

<template>
    <button :type="type" :class="classes" :disabled="disabled || loading" @click="handleClick">
        <component v-if="icon && iconPosition === 'left' && !loading" :is="icon" class="h-4 w-4" />

        <svg v-if="loading" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>

        <slot />

        <component v-if="icon && iconPosition === 'right'" :is="icon" class="h-4 w-4" />
    </button>
</template>
