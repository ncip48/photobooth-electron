<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
    show: { type: Boolean, default: false },
    title: { type: String, default: '' },
    maxWidth: {
        type: String,
        default: 'md',
        validator: (v) => ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].includes(v),
    },
    closeable: { type: Boolean, default: true },
})

const emit = defineEmits(['close'])

const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
}

const widthClass = computed(() => maxWidthClasses[props.maxWidth] || maxWidthClasses.md)

/* Lock body scroll while open */
watch(
    () => props.show,
    (open) => {
        if (typeof document === 'undefined') return
        document.body.style.overflow = open ? 'hidden' : ''
    }
)

onBeforeUnmount(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = ''
})

/* Close on backdrop click */
const onBackdrop = () => {
    if (props.closeable) emit('close')
}

/* Close on Escape */
const onKeydown = (e) => {
    if (e.key === 'Escape' && props.show && props.closeable) emit('close')
}

watch(
    () => props.show,
    (open) => {
        if (typeof document === 'undefined') return
        if (open) document.addEventListener('keydown', onKeydown)
        else document.removeEventListener('keydown', onKeydown)
    }
)
</script>

<template>
    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4" role="dialog"
                aria-modal="true" @click.self="onBackdrop">
                <Transition enter-active-class="transition duration-200 ease-out"
                    enter-from-class="translate-y-2 opacity-0" enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in" leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="translate-y-2 opacity-0">
                    <div v-if="show" class="palette-shell relative w-full" :class="widthClass">
                        <!-- Header -->
                        <header v-if="title || $slots.header || $slots.close"
                            class="flex items-center justify-between gap-3 border-b-2 border-ink bg-lime px-5 py-4">
                            <div class="min-w-0 flex-1">
                                <h2 v-if="title" class="display truncate text-lg font-bold tracking-tight text-ink">
                                    {{ title }}
                                </h2>
                                <slot name="header" />
                            </div>
                            <slot name="close">
                                <button v-if="closeable" type="button" class="icon-btn !h-8 !w-8" aria-label="Tutup"
                                    @click="emit('close')">
                                    <XMarkIcon class="h-4 w-4" />
                                </button>
                            </slot>
                        </header>

                        <!-- Body -->
                        <div class="px-5 py-6">
                            <slot />
                        </div>

                        <!-- Footer -->
                        <footer v-if="$slots.footer"
                            class="flex flex-wrap items-center justify-end gap-3 border-t-2 border-ink bg-paper px-5 py-4">
                            <slot name="footer" />
                        </footer>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
