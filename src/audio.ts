const targetSampleRate = 16000;

function writeString(view: DataView, offset: number, value: string) {
  [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  samples.forEach((sample, index) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * bytesPerSample, clipped * 0x7fff, true);
  });
  return new Blob([buffer], { type: 'audio/wav' });
}

function downsample(buffer: AudioBuffer) {
  const outputLength = Math.ceil((buffer.length * targetSampleRate) / buffer.sampleRate);
  const output = new Float32Array(outputLength);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index)
  );
  for (let index = 0; index < outputLength; index += 1) {
    const position = (index * buffer.sampleRate) / targetSampleRate;
    const left = Math.floor(position);
    const right = Math.min(left + 1, buffer.length - 1);
    const mix = channels.reduce((sum, channel) => {
      const value = channel[left] + (channel[right] - channel[left]) * (position - left);
      return sum + value / channels.length;
    }, 0);
    output[index] = mix;
  }
  return output;
}

export async function recordedAudioToWav(blob: Blob) {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('此设备不支持音频转换。');
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration > 30) throw new Error('请将单次跟读控制在 30 秒以内。');
    return encodeWav(downsample(decoded), targetSampleRate);
  } finally {
    await context.close();
  }
}

export async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}
