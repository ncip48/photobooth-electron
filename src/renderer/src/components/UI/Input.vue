<script setup>
import { computed, ref, onMounted } from 'vue'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
    modelValue: { type: [String, Number], default: '' },
    label: { type: String, default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    error: { type: String, default: '' },
    hint: { type: String, default: '' },
    prefix: { type: String, default: '' },
    suffix: { type: String, default: '' },
    icon: { type: Object, default: null },
    autocomplete: { type: String, default: 'off' },
    min: { type: [String, Number], default: undefined },
    max: { type: [String, Number], default: undefined },
    step: { type: [String, Number], default: undefined },
    rows: { type: Number, default: 3 },
    inputClass: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus', 'keydown'])

const showPassword = ref(false)
const inputType = ref(props.type)

onMounted(() => {
    if (props.type === 'password') inputType.value = 'password'
})

const togglePasswordVisibility = () => {
    showPassword.value = !showPassword.value
    inputType.value = showPassword.value ? 'text' : 'password'
}

const handleInput = (event) => {
    let value = event.target.value
    if (props.type === 'number') value = parseFloat(value) || 0
    emit('update:modelValue', value)
}

const inputClasses = computed(() => [
    'w-full border-2 bg-paper-soft text-[13.5px] text-ink transition-colors placeholder:text-ink/30 focus:outline-none',
    'py-2.5',
    (props.prefix || props.icon) ? 'pl-10' : 'pl-3.5',
    (props.suffix || props.type === 'password') ? 'pr-10' : 'pr-3.5',
    props.error
        ? 'border-[#b3261e] bg-[#ffb3ab]/20 focus:border-[#b3261e]'
        : 'border-ink focus:border-blue focus:bg-paper',
    props.disabled ? 'cursor-not-allowed bg-ink/5 opacity-60' : '',
    props.readonly ? 'bg-ink/5' : '',
    props.inputClass,
])

const isTextarea = computed(() => props.type === 'textarea')
</script>

<template>
    <div class="space-y-1.5">
        <!-- Label -->
        <label v-if="label" class="eyebrow block text-ink/60">
            {{ label }}
            <span v-if="required" class="ml-1 text-blue">*</span>
        </label>

        <!-- Input Wrapper -->
        <div class="relative">
            <!-- Prefix Icon -->
            <div v-if="icon" class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <component :is="icon" class="h-4 w-4 text-ink/40" />
            </div>

            <!-- Prefix Text -->
            <span v-if="prefix && !icon"
                class="display absolute inset-y-0 left-0 flex items-center pl-3 text-[12px] font-bold text-ink/50">
                {{ prefix }}
            </span>

            <!-- Textarea -->
            <textarea v-if="isTextarea" :value="modelValue" :placeholder="placeholder" :required="required"
                :disabled="disabled" :readonly="readonly" :rows="rows" :class="inputClasses" @input="handleInput"
                @blur="emit('blur', $event)" @focus="emit('focus', $event)" />

            <!-- Select -->
            <select v-else-if="type === 'select'" :value="modelValue" :required="required" :disabled="disabled"
                :class="[inputClasses, 'appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10']"
                style="background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2320201e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;)"
                @change="handleInput" @blur="emit('blur', $event)" @focus="emit('focus', $event)">
                <slot />
            </select>

            <!-- Input -->
            <input v-else :type="inputType" :value="modelValue" :placeholder="placeholder" :required="required"
                :disabled="disabled" :readonly="readonly" :autocomplete="autocomplete" :min="min" :max="max"
                :step="step" :class="inputClasses" @input="handleInput" @blur="emit('blur', $event)"
                @focus="emit('focus', $event)" @keydown="emit('keydown', $event)" />

            <!-- Suffix -->
            <span v-if="suffix"
                class="display absolute inset-y-0 right-0 flex items-center pr-3 text-[12px] font-bold text-ink/50">
                {{ suffix }}
            </span>

            <!-- Password Toggle -->
            <button v-if="type === 'password'" type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-ink/40 transition-colors hover:text-blue"
                tabindex="-1" @click="togglePasswordVisibility">
                <component :is="showPassword ? EyeSlashIcon : EyeIcon" class="h-4 w-4" />
            </button>
        </div>

        <!-- Error -->
        <p v-if="error" class="flex items-center gap-1.5 text-[12px] font-semibold text-[#b3261e]">
            <span class="inline-block h-1 w-1 bg-[#b3261e]" />
            {{ error }}
        </p>

        <!-- Hint -->
        <p v-else-if="hint" class="text-[11.5px] text-ink/50">{{ hint }}</p>
    </div>
</template>
