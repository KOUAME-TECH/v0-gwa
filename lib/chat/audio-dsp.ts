/**
 * Pipeline audio studio léger (Web Audio) pour vocaux chat.
 * High-pass + compression douce + mesure de niveau — sans dépendance npm.
 */

export type VoiceDspHandles = {
  /** Stream à brancher sur MediaRecorder (post-DSP). */
  processedStream: MediaStream
  /** Niveau RMS 0–1 (mise à jour ~raf). */
  getLevel: () => number
  /** Arrêt contexte + tracks source. */
  stop: () => void
}

const HIGHPASS_HZ = 85
const COMPRESSOR = {
  threshold: -24,
  knee: 12,
  ratio: 3,
  attack: 0.003,
  release: 0.25,
} as const

/**
 * Construit un graphe AudioContext :
 * MediaStreamSource → BiquadFilter(highpass) → DynamicsCompressor → Analyser + Destination
 */
export async function createVoiceDspPipeline(
  rawStream: MediaStream,
): Promise<VoiceDspHandles> {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined

  if (!AudioCtx) {
    return {
      processedStream: rawStream,
      getLevel: () => 0,
      stop: () => {
        rawStream.getTracks().forEach((t) => t.stop())
      },
    }
  }

  const ctx = new AudioCtx()
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined)
  }

  const source = ctx.createMediaStreamSource(rawStream)
  const highpass = ctx.createBiquadFilter()
  highpass.type = "highpass"
  highpass.frequency.value = HIGHPASS_HZ
  highpass.Q.value = 0.7

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = COMPRESSOR.threshold
  compressor.knee.value = COMPRESSOR.knee
  compressor.ratio.value = COMPRESSOR.ratio
  compressor.attack.value = COMPRESSOR.attack
  compressor.release.value = COMPRESSOR.release

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.65

  const dest = ctx.createMediaStreamDestination()

  source.connect(highpass)
  highpass.connect(compressor)
  compressor.connect(analyser)
  compressor.connect(dest)

  const timeData = new Uint8Array(analyser.fftSize)
  let lastLevel = 0

  const getLevel = () => {
    analyser.getByteTimeDomainData(timeData)
    let sum = 0
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / timeData.length)
    lastLevel = Math.min(1, rms * 2.2)
    return lastLevel
  }

  return {
    processedStream: dest.stream,
    getLevel,
    stop: () => {
      try {
        source.disconnect()
        highpass.disconnect()
        compressor.disconnect()
        analyser.disconnect()
      } catch {
        /* already torn down */
      }
      rawStream.getTracks().forEach((t) => t.stop())
      void ctx.close().catch(() => undefined)
    },
  }
}

/** Construit les contraintes micro recommandées (NS + AEC + AGC). */
export function voiceCaptureConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  }
}
