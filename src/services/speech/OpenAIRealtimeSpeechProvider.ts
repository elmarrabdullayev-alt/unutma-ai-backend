import { SpeechCallbacks, SpeechRecognitionProvider } from './SpeechRecognitionProvider';
import { apiClient } from '../apiClient';
import {
  downsampleBuffer,
  floatTo16BitPCM,
  pcm16ToBase64,
  calculateAudioLevel,
} from '../../utils/audioStreamUtils';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

/**
 * [REALTIME-STT] OpenAI Realtime Transcription Provider.
 * Streams PCM 16-bit 24kHz audio chunks to OpenAI Realtime API.
 * Uses model: gpt-live-transcribe.
 * Handles: conversation.item.input_audio_transcription.delta for immediate live transcript updates.
 */
export class OpenAIRealtimeSpeechProvider implements SpeechRecognitionProvider {
  public name = 'OpenAIRealtimeSpeechProvider';
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isStreaming = false;
  private accumulatedTranscript = '';
  private currentAudioLevel = 0;
  private nativeListenerHandle: any = null;
  private callbacks: SpeechCallbacks | null = null;
  private isFinalReceived = false;

  public isAvailable(): boolean {
    // Available if WebSocket is supported and either mediaDevices or native recorder is present
    const hasWebSocket = typeof WebSocket !== 'undefined';
    const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const isNative = Capacitor.isNativePlatform();
    return hasWebSocket && (hasMedia || isNative);
  }

  public async start(callbacks: SpeechCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.accumulatedTranscript = '';
    this.isFinalReceived = false;
    this.currentAudioLevel = 0;

    console.log('[REALTIME-STT] Starting OpenAI Realtime transcription stream (gpt-live-transcribe)');

    // 1. Establish WebSocket connection to backend /api/realtime-stt
    const wsUrl = apiClient.getWebSocketUrl('/api/realtime-stt');
    console.log(`[REALTIME-STT] Connecting to gateway: ${wsUrl}`);

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const connectionTimeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            ws.close();
          } catch {}
          reject(new Error('Realtime STT WebSocket connection timed out.'));
        }
      }, 7000);

      ws.onopen = () => {
        console.log('[REALTIME-STT] WebSocket connected to backend STT gateway');
        if (!isSettled) {
          isSettled = true;
          clearTimeout(connectionTimeout);
          resolve();
        }
      };

      ws.onerror = (err) => {
        console.warn('[REALTIME-STT] WebSocket error:', err);
        if (!isSettled) {
          isSettled = true;
          clearTimeout(connectionTimeout);
          reject(new Error('Realtime STT WebSocket connection failed.'));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle live transcription delta: conversation.item.input_audio_transcription.delta
          if (msg.type === 'conversation.item.input_audio_transcription.delta') {
            const delta = msg.delta || '';
            if (delta) {
              this.accumulatedTranscript += delta;
              console.log(
                `[REALTIME-STT] [gpt-live-transcribe] conversation.item.input_audio_transcription.delta: "${delta}" -> current: "${this.accumulatedTranscript}"`
              );
              // Immediately update transcript block while speaking (no waiting for stopRecording)
              this.callbacks?.onResult(this.accumulatedTranscript, false);
            }
          } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            const final = (msg.transcript || this.accumulatedTranscript).trim();
            this.accumulatedTranscript = final;
            this.isFinalReceived = true;
            console.log(`[REALTIME-STT] [gpt-live-transcribe] Final transcript completed: "${final}"`);
            // Only the final completed transcript triggers AI actions
            this.callbacks?.onResult(final, true);
          } else if (msg.type === 'input_audio_buffer.speech_started') {
            console.log('[REALTIME-STT] Upstream speech started event');
          } else if (msg.type === 'input_audio_buffer.speech_stopped') {
            console.log('[REALTIME-STT] Upstream speech stopped event');
          } else if (msg.type === 'session.ready') {
            console.log('[REALTIME-STT] Upstream session ready with model: gpt-live-transcribe');
          } else if (msg.type === 'error') {
            console.warn('[REALTIME-STT] Server reported STT error:', msg.error);
            this.callbacks?.onError(new Error(msg.error || 'STT error occurred'));
          }
        } catch (e) {
          console.error('[REALTIME-STT] Error parsing STT message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[REALTIME-STT] WebSocket closed');
        if (this.isStreaming) {
          this.isStreaming = false;
          this.callbacks?.onEnd();
        }
      };
    });

    // 2. Start streaming microphone audio chunks
    this.isStreaming = true;
    await this.startAudioCapture();
  }

  private async startAudioCapture(): Promise<void> {
    const isNative = Capacitor.isNativePlatform();

    // If native iOS/Android, listen for native audio chunks if available
    if (isNative) {
      try {
        console.log('[REALTIME-STT] Initializing native audio stream listener on iPhone/native device');
        // Register listener for native realtime chunks if plugin supports it
        const pluginAny = VoiceRecorder as any;
        if (typeof pluginAny.addListener === 'function') {
          this.nativeListenerHandle = await pluginAny.addListener(
            'realtimeAudioChunk',
            (chunkData: { data: string; format?: string }) => {
              if (this.isStreaming && chunkData?.data && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(
                  JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: chunkData.data,
                  })
                );
              }
            }
          );
        }
      } catch (err) {
        console.warn('[REALTIME-STT] Native chunk listener setup note:', err);
      }
    }

    // Capture microphone audio via Web Audio API (supported in modern browsers and iOS WKWebView)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      this.audioContext = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      // 2048 buffer size gives ~46ms-85ms latency per audio packet
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      this.scriptProcessor = processor;

      processor.onaudioprocess = (e) => {
        if (!this.isStreaming) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const level = calculateAudioLevel(inputData);
        this.currentAudioLevel = level;
        this.callbacks?.onAudioLevel(level);

        // Resample from input sample rate (e.g. 44.1k/48k) to 24kHz required by OpenAI Realtime
        const resampled = downsampleBuffer(inputData, audioCtx.sampleRate, 24000);
        const pcm16 = floatTo16BitPCM(resampled);
        const base64Chunk = pcm16ToBase64(pcm16);

        // Stream audio chunk while user speaks
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Chunk,
            })
          );
        }
      };

      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);
      console.log(`[REALTIME-STT] Live audio streaming active. Sample rate: ${audioCtx.sampleRate}Hz -> 24000Hz PCM16`);
    } catch (micErr: any) {
      console.error('[REALTIME-STT] Failed to acquire microphone stream:', micErr);
      // If Web Audio capture fails on native, native fallback takes over
      if (!isNative) {
        throw new Error(
          'Mikrofona icazə verilmədi və ya mikrofon tapılmadı: ' + (micErr.message || 'Bilinməyən xəta')
        );
      }
    }
  }

  public async stop(): Promise<string> {
    console.log('[REALTIME-STT] stop() called. Committing audio buffer.');
    this.isStreaming = false;

    // Send commit event to upstream to finalize transcription if needed
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.commit',
          })
        );
      } catch {}
    }

    // Clean up Web Audio resources
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }

    // Clean up native listener
    if (this.nativeListenerHandle) {
      try {
        if (typeof this.nativeListenerHandle.remove === 'function') {
          this.nativeListenerHandle.remove();
        }
      } catch {}
      this.nativeListenerHandle = null;
    }

    // Give a brief window (up to 600ms) for final completed event if not yet received
    if (!this.isFinalReceived && this.accumulatedTranscript) {
      await new Promise((r) => setTimeout(r, 300));
    }

    // Close WebSocket connection
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    const finalResult = this.accumulatedTranscript.trim();
    console.log(`[REALTIME-STT] Streaming finished. Result: "${finalResult}"`);
    return finalResult;
  }

  public getAudioLevel(): number {
    return this.currentAudioLevel;
  }
}
