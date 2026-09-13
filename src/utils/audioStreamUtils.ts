/**
 * Audio streaming utilities for OpenAI Realtime API (PCM 16-bit, 24kHz mono).
 * [REALTIME-STT] Audio conversion and streaming helpers.
 */

/**
 * Downsamples a Float32Array from inputSampleRate to outputSampleRate using linear interpolation.
 */
export function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number = 24000
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }
  if (inputSampleRate < outputSampleRate) {
    // If input sample rate is lower, return original buffer
    return buffer;
  }

  const sampleRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRatio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const originPos = i * sampleRatio;
    const originIndex = Math.floor(originPos);
    const decimal = originPos - originIndex;

    const nextIndex = Math.min(originIndex + 1, buffer.length - 1);
    result[i] = buffer[originIndex] * (1 - decimal) + buffer[nextIndex] * decimal;
  }

  return result;
}

/**
 * Converts Float32 audio samples (-1.0 to 1.0) to 16-bit signed PCM ArrayBuffer.
 */
export function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    // 16-bit Little-Endian signed integer
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Converts an ArrayBuffer of 16-bit PCM bytes into a base64 string.
 */
export function pcm16ToBase64(pcmBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(pcmBuffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks for String.fromCharCode safety

  for (let i = 0; i < len; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }

  return btoa(binary);
}

/**
 * Calculates RMS volume level (0.0 to 1.0) from Float32 audio samples for UI waveforms.
 */
export function calculateAudioLevel(samples: Float32Array): number {
  if (!samples || samples.length === 0) return 0;
  let sumSquare = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquare += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquare / samples.length);
  // Amplify slightly for visual responsiveness (0.0 to 1.0)
  return Math.min(1, Math.max(0, rms * 4.5));
}
