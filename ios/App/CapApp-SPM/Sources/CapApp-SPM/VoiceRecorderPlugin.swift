import Foundation
import AVFoundation
import Capacitor

/**
 * VoiceRecorderPlugin - Native iOS VoiceRecorder implementation for Capacitor 8+ SPM.
 * Provides high-quality native audio recording using AVAudioSession and AVAudioRecorder.
 * Registered with Objective-C runtime as VoiceRecorder for automatic SPM bridge loading.
 */
@objc(VoiceRecorder)
public class VoiceRecorder: CAPPlugin, CAPBridgedPlugin {
    // VoiceRecorderPlugin class identifier
    public static let pluginName = "VoiceRecorderPlugin"
    public let identifier = "VoiceRecorder"
    public let jsName = "VoiceRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canDeviceVoiceRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAudioRecordingPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasAudioRecordingPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentStatus", returnType: CAPPluginReturnPromise),
        // [REALTIME-STT] Dedicated streaming methods for gpt-live-transcribe
        CAPPluginMethod(name: "startRealtimeAudioStreaming", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRealtimeAudioStreaming", returnType: CAPPluginReturnPromise)
    ]

    private var audioRecorder: AVAudioRecorder?
    private var audioFilePath: URL?
    private var originalSessionCategory: AVAudioSession.Category?
    private var originalSessionOptions: AVAudioSession.CategoryOptions = []
    private var currentStatus: String = "NONE" // NONE, RECORDING, PAUSED
    private var recordingStartTime: Date?
    private var silenceMeterTimer: Timer?
    private var speechBegan: Bool = false
    private var silenceBeganTime: Date?
    private let speechThresholdDb: Float = -38.0
    private let silenceAutoStopTimeoutSec: TimeInterval = 1.3

    // [REALTIME-STT] AVAudioEngine for streaming live 16-bit PCM chunks to gpt-live-transcribe
    // Allows processing conversation.item.input_audio_transcription.delta while user is speaking
    private var audioEngine: AVAudioEngine?
    private var isRealtimeStreaming: Bool = false

    @objc public func canDeviceVoiceRecord(_ call: CAPPluginCall) {
        call.resolve(["value": true])
    }

    @objc public func hasAudioRecordingPermission(_ call: CAPPluginCall) {
        let status = AVAudioSession.sharedInstance().recordPermission
        let granted = (status == .granted)
        call.resolve(["value": granted])
    }

    @objc public func requestAudioRecordingPermission(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        session.requestRecordPermission { granted in
            DispatchQueue.main.async {
                call.resolve(["value": granted])
            }
        }
    }

    @objc public func startRecording(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        guard session.recordPermission == .granted else {
            call.reject("MISSING_PERMISSION")
            return
        }

        if let recorder = audioRecorder, recorder.isRecording {
            call.reject("ALREADY_RECORDING")
            return
        }

        do {
            originalSessionCategory = session.category
            originalSessionOptions = session.categoryOptions

            // Configure audio session for speech recording with output to speaker
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let tempDir = FileManager.default.temporaryDirectory
            let timestamp = Int(Date().timeIntervalSince1970 * 1000)
            let fileURL = tempDir.appendingPathComponent("recording-\(timestamp).m4a")
            self.audioFilePath = fileURL

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]

            let recorder = try AVAudioRecorder(url: fileURL, settings: settings)
            recorder.isMeteringEnabled = true
            recorder.prepareToRecord()

            guard recorder.record() else {
                call.reject("CANNOT_RECORD_ON_THIS_PHONE")
                return
            }

            self.audioRecorder = recorder
            self.currentStatus = "RECORDING"
            self.recordingStartTime = Date()
            self.speechBegan = false
            self.silenceBeganTime = nil

            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.silenceMeterTimer?.invalidate()
                self.silenceMeterTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                    self?.evaluateSilenceAutoStop()
                }
            }

            call.resolve(["value": true])
        } catch {
            self.audioRecorder = nil
            self.currentStatus = "NONE"
            self.silenceMeterTimer?.invalidate()
            self.silenceMeterTimer = nil
            call.reject("CANNOT_RECORD_ON_THIS_PHONE: \(error.localizedDescription)")
        }
    }

    private func evaluateSilenceAutoStop() {
        guard let recorder = self.audioRecorder, recorder.isRecording else {
            self.silenceMeterTimer?.invalidate()
            self.silenceMeterTimer = nil
            return
        }

        recorder.updateMeters()
        let avgPower = recorder.averagePower(forChannel: 0) // -160 dB to 0 dB

        if avgPower > self.speechThresholdDb {
            // Speech detected
            if !self.speechBegan {
                self.speechBegan = true
                self.notifyListeners("speechStarted", data: ["power": avgPower])
            }
            self.silenceBeganTime = nil
        } else if self.speechBegan {
            // Speech was detected earlier, now below threshold
            if self.silenceBeganTime == nil {
                self.silenceBeganTime = Date()
            } else if let silenceStart = self.silenceBeganTime,
                      Date().timeIntervalSince(silenceStart) >= self.silenceAutoStopTimeoutSec {
                print("[VOICE][iOS] auto-stopping: ~1.3s silence after speech")
                self.silenceMeterTimer?.invalidate()
                self.silenceMeterTimer = nil
                self.notifyListeners("silenceAutoStop", data: [
                    "silenceDuration": Date().timeIntervalSince(silenceStart)
                ])
            }
        }
    }

    @objc public func stopRecording(_ call: CAPPluginCall) {
        self.silenceMeterTimer?.invalidate()
        self.silenceMeterTimer = nil
        self.speechBegan = false
        self.silenceBeganTime = nil

        guard let recorder = audioRecorder else {
            call.reject("RECORDING_HAS_NOT_STARTED")
            return
        }

        let fileURL = self.audioFilePath
        let durationMs: Int
        if let startTime = self.recordingStartTime {
            durationMs = max(0, Int(Date().timeIntervalSince(startTime) * 1000))
        } else {
            durationMs = max(0, Int(recorder.currentTime * 1000))
        }

        recorder.stop()
        self.audioRecorder = nil
        self.currentStatus = "NONE"
        self.recordingStartTime = nil

        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        if let origCategory = originalSessionCategory {
            try? session.setCategory(origCategory, options: originalSessionOptions)
        }

        guard let url = fileURL, FileManager.default.fileExists(atPath: url.path) else {
            call.reject("FAILED_TO_FETCH_RECORDING")
            return
        }

        do {
            let audioData = try Data(contentsOf: url)
            let base64String = audioData.base64EncodedString()
            let recordingExtension = url.pathExtension
            let byteSize = audioData.count
            let returnedMimeType = "audio/m4a"

            print("[VOICE][iOS] recording extension: \(recordingExtension)")
            print("[VOICE][iOS] recording byte size: \(byteSize)")
            print("[VOICE][iOS] mimeType: \(returnedMimeType)")

            // Remove temporary file
            try? FileManager.default.removeItem(at: url)

            if base64String.isEmpty {
                call.reject("EMPTY_RECORDING")
                return
            }

            let response: [String: Any] = [
                "value": [
                    "recordDataBase64": base64String,
                    "mimeType": returnedMimeType,
                    "msDuration": durationMs
                ]
            ]
            call.resolve(response)
        } catch {
            call.reject("FAILED_TO_FETCH_RECORDING: \(error.localizedDescription)")
        }
    }

    @objc public func pauseRecording(_ call: CAPPluginCall) {
        if let recorder = audioRecorder, currentStatus == "RECORDING" {
            recorder.pause()
            currentStatus = "PAUSED"
            call.resolve(["value": true])
        } else {
            call.resolve(["value": false])
        }
    }

    @objc public func resumeRecording(_ call: CAPPluginCall) {
        if let recorder = audioRecorder, currentStatus == "PAUSED" {
            recorder.record()
            currentStatus = "RECORDING"
            call.resolve(["value": true])
        } else {
            call.resolve(["value": false])
        }
    }

    @objc public func getCurrentStatus(_ call: CAPPluginCall) {
        call.resolve(["status": currentStatus])
    }

    // =========================================================================
    // [REALTIME-STT] Native iOS Real-time Audio Stream Implementation
    // Streams PCM 16-bit 24kHz audio chunks to frontend WebSocket listener
    // Configured for OpenAI Realtime model: gpt-live-transcribe
    // Downstream receives: conversation.item.input_audio_transcription.delta
    // =========================================================================
    @objc public func startRealtimeAudioStreaming(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        guard session.recordPermission == .granted else {
            call.reject("MISSING_PERMISSION")
            return
        }

        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let engine = AVAudioEngine()
            let inputNode = engine.inputNode
            let bus = 0
            let inputFormat = inputNode.outputFormat(forBus: bus)

            print("[REALTIME-STT] Native iOS AVAudioEngine starting tap for gpt-live-transcribe")

            // Install tap on microphone input node
            inputNode.installTap(onBus: bus, bufferSize: 2048, format: inputFormat) { [weak self] (buffer, _) in
                guard let self = self, self.isRealtimeStreaming else { return }
                guard let channelData = buffer.floatChannelData?[0] else { return }
                let frameCount = Int(buffer.frameLength)
                guard frameCount > 0 else { return }

                // Convert float samples to 16-bit linear PCM (Little Endian)
                var pcmData = Data(count: frameCount * 2)
                pcmData.withUnsafeMutableBytes { rawBuffer in
                    guard let pcmPointer = rawBuffer.bindMemory(to: Int16.self).baseAddress else { return }
                    for i in 0..<frameCount {
                        let sample = channelData[i]
                        let clamped = max(-1.0, min(1.0, sample))
                        pcmPointer[i] = Int16(clamped * 32767.0)
                    }
                }

                let base64Chunk = pcmData.base64EncodedString()
                // Emit realtime audio chunk to JavaScript listeners
                // Downstream handler feeds OpenAI Realtime -> conversation.item.input_audio_transcription.delta
                self.notifyListeners("realtimeAudioChunk", data: [
                    "data": base64Chunk,
                    "format": "pcm16",
                    "sampleRate": inputFormat.sampleRate
                ])
            }

            engine.prepare()
            try engine.start()

            self.audioEngine = engine
            self.isRealtimeStreaming = true
            call.resolve(["value": true, "model": "gpt-live-transcribe"])
        } catch {
            print("[REALTIME-STT] Failed to start native AVAudioEngine: \(error.localizedDescription)")
            call.reject("STREAM_START_FAILED: \(error.localizedDescription)")
        }
    }

    @objc public func stopRealtimeAudioStreaming(_ call: CAPPluginCall) {
        self.isRealtimeStreaming = false
        if let engine = self.audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
            self.audioEngine = nil
            print("[REALTIME-STT] Native iOS AVAudioEngine stopped")
        }
        call.resolve(["value": true])
    }
}
