// onnxruntime-node 1.17 names dist/index.d.ts in its package.json but doesn't ship it.
// The segmenter uses it through its own typed `OrtLike` interface.
declare module 'onnxruntime-node'
