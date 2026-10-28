// Downloads the local AI models the server needs that npm doesn't ship, and checks their hashes.
// - SegFormer B2 "clothes" (ONNX, quantized): finds which pixels are clothes vs. skin/hair, to cut
//   the person out of worn-garment photos. Weights: mattmdjaga/segformer_b2_clothes, under the
//   NVIDIA SegFormer licence (non-commercial use only).
// Without --strict a failed download only warns (the app then cuts garments out without it).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MODELS = [
  {
    file: 'vendor/models/segformer-clothes/model_quantized.onnx',
    url: 'https://huggingface.co/Xenova/segformer_b2_clothes/resolve/cb6ac44e641faa309f29561c1afe08d87ef52631/onnx/model_quantized.onnx',
    sha256: '2b18fbdd196a7ee12702c2fceaa6f812fe70d1154573a43bd62667b9157ee48d',
    notice:
      'SegFormer B2 fine-tuned for clothes segmentation (mattmdjaga/segformer_b2_clothes, ONNX export Xenova/segformer_b2_clothes).\n' +
      'Licence: NVIDIA Source Code License for SegFormer, non-commercial use only. https://github.com/NVlabs/SegFormer/blob/master/LICENSE\n',
  },
]

const strict = process.argv.includes('--strict')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

async function fetchModel({ file, url, sha256: expected, notice }) {
  if (existsSync(file) && sha256(readFileSync(file)) === expected) return `${file} (present)`
  mkdirSync(dirname(file), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const got = sha256(buf)
  if (got !== expected) throw new Error(`${file}: sha256 ${got}, expected ${expected}`)
  writeFileSync(`${file}.part`, buf)
  renameSync(`${file}.part`, file)
  writeFileSync(join(dirname(file), 'NOTICE.txt'), notice)
  return `${file} (downloaded, ${(buf.length / 1e6).toFixed(1)} MB)`
}

for (const model of MODELS) {
  try {
    console.log(`models: ${await fetchModel(model)}`)
  } catch (e) {
    rmSync(`${model.file}.part`, { force: true })
    if (strict) throw e
    console.warn(`models: could not fetch ${model.file}; garments will be cut out without it. ${e.message}`)
  }
}
