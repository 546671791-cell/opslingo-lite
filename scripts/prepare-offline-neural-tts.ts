/**
 * Prepares a local-only American-English neural voice for the Android APK.
 *
 * The large runtime and voice assets are fetched at build time from immutable
 * upstream revisions. The small Apache-2.0 Kotlin API binding is vendored in
 * source control so a transient raw-GitHub failure cannot break release builds.
 *
 * Runtime: Apache-2.0 (sherpa-onnx v1.13.4)
 * Model: official kokoro-int8-en-v0_19 release. The quantized model keeps the
 * same 11 US/UK voices while avoiding the full model's mobile memory spike.
 */
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const androidRoot = join(projectRoot, 'android');
const cacheRoot = join(androidRoot, '.offline-tts-cache');
const appRoot = join(androidRoot, 'app', 'src', 'main');
const assetsRoot = join(appRoot, 'assets');
const jniRoot = join(appRoot, 'jniLibs');
const modelRoot = join(assetsRoot, 'kokoro-int8-en-v0_19');

const runtimeUrl =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.4/sherpa-onnx-v1.13.4-android.tar.bz2';
const modelUrl =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2';

function log(message: string) {
  process.stdout.write(`[offline-neural-tts] ${message}\n`);
}

function run(command: string, args: string[], cwd = projectRoot) {
  execFileSync(command, args, { cwd, stdio: 'inherit', env: process.env });
}

function download(url: string, destination: string) {
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination) && statSync(destination).size > 0) return;
  const partial = `${destination}.part`;
  log(`Downloading ${url.split('/').at(-1)}. This happens once and may take a few minutes.`);
  run('curl', [
    '--fail',
    '--location',
    '--http1.1',
    '--retry',
    '12',
    '--retry-all-errors',
    '--retry-delay',
    '2',
    '--continue-at',
    '-',
    '--output',
    partial,
    url
  ]);
  renameSync(partial, destination);
}

function extract(archive: string, destination: string) {
  const staging = `${destination}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  run('tar', ['-xjf', archive, '--strip-components=1', '-C', staging]);
  rmSync(destination, { recursive: true, force: true });
  renameSync(staging, destination);
}

function main() {
  mkdirSync(cacheRoot, { recursive: true });
  const runtimeArchive = join(cacheRoot, 'sherpa-onnx-v1.13.4-android.tar.bz2');
  if (!existsSync(join(jniRoot, 'arm64-v8a', 'libsherpa-onnx-jni.so'))) {
    download(runtimeUrl, runtimeArchive);
    extract(runtimeArchive, jniRoot);
  }
  if (process.env.OPSLINGO_SKIP_MODEL_DOWNLOAD === '1') {
    log('Skipping model payload only for local native compilation verification.');
    return;
  }
  const modelArchive = join(cacheRoot, 'kokoro-int8-en-v0_19.tar.bz2');
  const modelFile = join(modelRoot, 'model.int8.onnx');
  if (!existsSync(modelFile) || statSync(modelFile).size < 80 * 1024 * 1024) {
    download(modelUrl, modelArchive);
    extract(modelArchive, modelRoot);
  }
  const modelBytes = statSync(modelFile).size;
  if (modelBytes < 80 * 1024 * 1024 || modelBytes > 180 * 1024 * 1024) {
    throw new Error(
      'The INT8 neural model has an unexpected size; refusing to build an incomplete APK.'
    );
  }
  for (const required of ['voices.bin', 'tokens.txt', 'espeak-ng-data/en_dict', 'LICENSE']) {
    if (!existsSync(join(modelRoot, required))) {
      throw new Error(`The offline neural voice package is missing ${required}.`);
    }
  }
  log('Offline neural American-English voice is ready for APK packaging.');
}

main();
