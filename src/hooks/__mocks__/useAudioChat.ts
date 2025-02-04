export const useAudioChat = jest.fn(() => ({
  isRecording: false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  audioUrl: null,
  transcription: null,
  isTranscribing: false,
}));