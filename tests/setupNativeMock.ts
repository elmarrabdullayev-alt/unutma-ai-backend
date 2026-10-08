// Setup Native Capacitor mock before any plugin evaluation
(globalThis as any).window = (globalThis as any).window || globalThis;
(globalThis as any).Capacitor = {
  isNative: true,
  PluginHeaders: [
    {
      name: 'VoiceRecorder',
      methods: [
        { name: 'hasAudioRecordingPermission', rtype: 'promise' },
        { name: 'requestAudioRecordingPermission', rtype: 'promise' },
        { name: 'startRecording', rtype: 'promise' },
        { name: 'stopRecording', rtype: 'promise' },
        { name: 'getCurrentStatus', rtype: 'promise' },
      ],
    },
  ],
  nativePromise: async (plugin: string, method: string, args: any) => {
    if (typeof (globalThis as any).__nativePromiseHandler === 'function') {
      return (globalThis as any).__nativePromiseHandler(plugin, method, args);
    }
    return { value: true, status: 'NONE' };
  },
};

Object.defineProperty(globalThis, 'navigator', {
  value: {
    permissions: { query: async () => ({ state: 'granted' }) },
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
  },
  configurable: true,
});
