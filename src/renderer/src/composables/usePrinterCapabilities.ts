
import { computed, ref, watch } from 'vue'

interface PaperSize {
    id: string
    name: string
    widthMicrons: number | null
    heightMicrons: number | null
    source: 'driver'
}

interface PrinterCapabilities {
    printerName: string
    platform: string
    source: 'windows-driver' | 'cups-driver'
    papers: PaperSize[]
    warning?: string
}

interface CapabilitiesResponse {
    success: boolean
    capabilities: PrinterCapabilities | null
    error?: string
}

export function usePrinterCapabilities() {
    const printerName = ref('')
    const capabilities = ref<PrinterCapabilities | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const papers = computed(
        () => capabilities.value?.papers ?? [],
    )

    const printablePapers = computed(() =>
        papers.value.filter(
            (paper) =>
                paper.widthMicrons !== null &&
                paper.heightMicrons !== null &&
                paper.widthMicrons > 0 &&
                paper.heightMicrons > 0,
        ),
    )

    async function loadCapabilities(name: string) {
        printerName.value = name
        capabilities.value = null
        error.value = null

        if (!name) return

        loading.value = true

        try {
            const result =
                (await window.electronAPI.getPrinterCapabilities(
                    name,
                )) as CapabilitiesResponse

            if (!result.success || !result.capabilities) {
                throw new Error(
                    result.error ?? 'Failed to read paper sizes.',
                )
            }

            capabilities.value = result.capabilities
        } catch (err) {
            error.value =
                err instanceof Error
                    ? err.message
                    : 'Unable to read printer capabilities.'
        } finally {
            loading.value = false
        }
    }

    watch(printerName, (name) => {
        void loadCapabilities(name)
    })

    return {
        printerName,
        capabilities,
        papers,
        printablePapers,
        loading,
        error,
        loadCapabilities,
    }
}
