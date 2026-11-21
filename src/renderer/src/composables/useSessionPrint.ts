// src/composables/useSessionPrint.ts
import { computed, ref } from 'vue'
import { useActiveEvent } from '@/composables/useEvents'
import { usePrint } from '@/composables/usePrint'
import { loadPrintSettings } from '@/lib/printStorage'
import type { PhotoboothSession } from '@/composables/useSessionGallery'

export const useSessionPrint = () => {
    const { data: event } = useActiveEvent()
    const { printImage, printing, error: printError } = usePrint()

    const printMessage = ref('')

    const settings = loadPrintSettings()

    const additionalPricePerStrip = computed(
        () => event.value?.additional_price_per_print_strip ?? 0,
    )
    const maxPrintStrip = computed(() => event.value?.max_print_strip ?? 1)

    /**
     * Ambil dataURL dari preview URL photostrip.
     */
    async function resolvePhotostripDataUrl(session: PhotoboothSession): Promise<string> {
        const url = session.preview?.url
        if (!url) throw new Error('Photostrip belum tersedia untuk sesi ini.')

        const res = await fetch(url)
        if (!res.ok) throw new Error('Gagal mengambil gambar photostrip.')
        const blob = await res.blob()

        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error('Gagal membaca blob.'))
            reader.readAsDataURL(blob)
        })
    }

    /**
     * Skala isi gambar pada kanvas putih (sama persis dengan Result).
     */
    async function scaleImageDataUrl(dataUrl: string, scalePercent: number): Promise<string> {
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('Gagal memuat gambar untuk print.'))
            image.src = dataUrl
        })

        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context tidak tersedia.')

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const scale = Math.max(1, Math.min(100, scalePercent)) / 100
        const width = canvas.width * scale
        const height = canvas.height * scale
        const x = (canvas.width - width) / 2
        const y = (canvas.height - height) / 2

        ctx.drawImage(image, x, y, width, height)

        return canvas.toDataURL('image/jpeg', 1)
    }

    async function handlePrint(session: PhotoboothSession, qty: number) {
        if (printing.value) return
        printMessage.value = ''

        try {
            const imageDataUrl = await resolvePhotostripDataUrl(session)
            const scaled = await scaleImageDataUrl(imageDataUrl, settings.scaleFactor)
            await printImage(scaled, { copies: qty })
            printMessage.value = `Berhasil mengirim ${qty} salinan ke printer.`
        } catch (err: any) {
            console.error('[SessionPrint] Print failed:', err)
        }
    }

    return {
        printing,
        printError,
        printMessage,
        additionalPricePerStrip,
        maxPrintStrip,
        handlePrint,
    }
}