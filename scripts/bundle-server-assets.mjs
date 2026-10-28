// Makes .output/server self-contained and lean after `nuxt build`, for the platform it runs on:
// - copies the background-removal model the app uses (imgly "medium") next to the traced imgly package;
// - copies the clothes-segmentation model (scripts/fetch-models.mjs) to .output/server/models;
// - keeps only this platform's CPU ONNX runtime (drops other OSes and the ~480 MB CUDA/TensorRT providers).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MODEL = '/models/medium'
const GPU_PROVIDERS = /providers_(cuda|tensorrt)/

const out = '.output/server/node_modules'
if (!existsSync(out)) throw new Error('Run `nuxt build` first: .output/server/node_modules is missing.')

// imgly model
const imglySrc = 'node_modules/@imgly/background-removal-node/dist'
const imglyDst = join(out, '@imgly/background-removal-node/dist')
const resources = JSON.parse(readFileSync(join(imglySrc, 'resources.json'), 'utf8'))
const model = resources[MODEL]
if (!model) throw new Error(`imgly has no ${MODEL} model`)
mkdirSync(imglyDst, { recursive: true })
writeFileSync(join(imglyDst, 'resources.json'), JSON.stringify({ [MODEL]: model }))
for (const { hash } of model.chunks) cpSync(join(imglySrc, hash), join(imglyDst, hash))

// clothes segmentation model (found by searching upwards for models/segformer-clothes)
const segSrc = 'vendor/models/segformer-clothes'
if (!existsSync(join(segSrc, 'model_quantized.onnx'))) throw new Error('The clothes model is missing: run `npm run models` first.')
cpSync(segSrc, '.output/server/models/segformer-clothes', { recursive: true })

// ONNX runtime: this platform and CPU only
const ortBin = 'node_modules/onnxruntime-node/bin/napi-v3'
const target = join(process.platform, process.arch)
if (!existsSync(join(ortBin, target))) throw new Error(`onnxruntime-node has no binaries for ${target}`)
const ortDst = join(out, 'onnxruntime-node/bin/napi-v3')
rmSync(ortDst, { recursive: true, force: true })
cpSync(join(ortBin, target), join(ortDst, target), { recursive: true, filter: (src) => !GPU_PROVIDERS.test(src) })

console.log(`server assets: imgly ${MODEL} (${model.chunks.length} chunks), segformer-clothes, onnxruntime ${target} (CPU)`)
