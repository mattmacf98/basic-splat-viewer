import { SplattedVertex } from "./SplattedVertex";
import splat_shader from "./shaders/splat_shader.wgsl?raw";
import * as glMatrix from "gl-matrix";
export class Splats {
    private _pipeline: GPURenderPipeline;
    private _numVertices: number;
    private _splatBindGroup: GPUBindGroup;
    private _splatPositionBuffer: GPUBuffer;
    private _splatIdsBuffer: GPUBuffer;
    private _basisBuffer: GPUBuffer;
    private _splats: SplattedVertex[];

    constructor(device: GPUDevice, vertices: SplattedVertex[], viewParamsBindGroupLayout: GPUBindGroupLayout) {
        const shaderModule = device.createShaderModule({
            code: splat_shader
          });
      
          const positions = new Float32Array(vertices.flatMap(vertex => [vertex.position[0], vertex.position[1], vertex.position[2], 0.0]));
          const basis = new Float32Array(vertices.flatMap(vertex => [vertex.basis[0], vertex.basis[1], vertex.basis[2], vertex.basis[3]]));
          const colorsArray = [];
          for (let i = 0; i < vertices.length; i++) {
            colorsArray.push(vertices[i].color[0], vertices[i].color[1], vertices[i].color[2], vertices[i].opacity);
          }
          const colors = new Float32Array(colorsArray);

          // UPLPOAD SPLAT DATA TO GPU AS UNIFORMS
          const splatBindGroupLayout = device?.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                }
            ],
          });
          const positionsBuffer = device?.createBuffer({
            size: 4 * Float32Array.BYTES_PER_ELEMENT * vertices.length,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
          });
          const positionsData = positionsBuffer.getMappedRange();
          new Float32Array(positionsData).set(positions);
          positionsBuffer.unmap();
          
          const basisBuffer = device?.createBuffer({
            size: 4 * Float32Array.BYTES_PER_ELEMENT * vertices.length,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
          });
          const basisData = basisBuffer.getMappedRange();
          new Float32Array(basisData).set(basis);
          basisBuffer.unmap();

          const colorsBuffer = device?.createBuffer({
            size: 4 * Float32Array.BYTES_PER_ELEMENT * vertices.length,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
          });
          const colorsData = colorsBuffer.getMappedRange();
          new Float32Array(colorsData).set(colors);
          colorsBuffer.unmap();

          const splatBindGroup = device?.createBindGroup({
            layout: splatBindGroupLayout,
            entries: [{
              binding: 0,
              resource: {buffer: positionsBuffer},
            },
            {
              binding: 1,
              resource: {buffer: basisBuffer},
            },
            {
              binding: 2,
              resource: {buffer: colorsBuffer},
            }],
          });
      
          //CREATE VERTEX ATTRIBUTE BUFFERS
          const splatPos = new Float32Array([
            1, 1,
            -1, 1,
            1, -1,
            -1, -1
          ]);
          const splatPosBuffer = device?.createBuffer({
            size: 2 * Float32Array.BYTES_PER_ELEMENT * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
          });
          const splatPosData = splatPosBuffer.getMappedRange();
          new Float32Array(splatPosData).set(splatPos);
          splatPosBuffer.unmap();
          const splatPositionBufferLayoutDescriptor: GPUVertexBufferLayout = {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'vertex',
            attributes: [{
              format: 'float32x2',
              offset: 0,
              shaderLocation: 0
            }]
          };

          const splatIds = new Uint32Array(vertices.length).fill(0).map((_, i) => i); // for now just dumb ids
          const splatIdsBuffer = device?.createBuffer({
            size: Uint32Array.BYTES_PER_ELEMENT * vertices.length,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
          });
          const splatIdsData = splatIdsBuffer.getMappedRange();
          new Uint32Array(splatIdsData).set(splatIds);
          splatIdsBuffer.unmap();
          const splatIdsBufferLayoutDescriptor: GPUVertexBufferLayout = {
            arrayStride: Uint32Array.BYTES_PER_ELEMENT,
            stepMode: 'instance',
            attributes: [{
              format: 'uint32',
              offset: 0,
              shaderLocation: 1
            }]
          };

          
          //CREATE PIPELINE
          const colorState: GPUColorTargetState = {
            format: 'bgra8unorm',
            blend: {
                alpha: {
                    operation: "add",
                    srcFactor: 'one',
                    dstFactor: 'one-minus-src-alpha',
                },
                color: {
                    operation: "add",
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                }
            }
          };  

          const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({
              bindGroupLayouts:[viewParamsBindGroupLayout, splatBindGroupLayout]
            }),
            vertex: {
              module: shaderModule,
              entryPoint: 'vs_main',
              buffers: [splatPositionBufferLayoutDescriptor, splatIdsBufferLayoutDescriptor]
            },
            fragment: {
              module: shaderModule,
              entryPoint: 'fs_main',
              targets: [colorState]
            },
            primitive: {
              topology: 'triangle-strip',
              frontFace: 'ccw',
              cullMode: 'none'
            }
          })
      
          this._pipeline = pipeline;
          this._numVertices = vertices.length;
          this._splatBindGroup = splatBindGroup;
          this._splatPositionBuffer = splatPosBuffer;
          this._splatIdsBuffer = splatIdsBuffer;
          this._splats = vertices;
          this._basisBuffer = basisBuffer;
        }

        public updateBasisBuffer(device: GPUDevice, projectionMatrix: glMatrix.mat4, modelViewMatrix: glMatrix.mat4, canvas: HTMLCanvasElement, commandEncoder: GPUCommandEncoder): GPUBuffer {
            for (let i = 0; i < this._splats.length; i++) {
                this._splats[i].updateBasis(projectionMatrix, modelViewMatrix, canvas);
            }
            const basisUpdateBuffer = device?.createBuffer({
                size: 4 * Float32Array.BYTES_PER_ELEMENT * this._splats.length,
                usage: GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true,
            });
            const basisDataMap = new Float32Array(basisUpdateBuffer.getMappedRange());
            const basisData = this._splats.flatMap(splat => [splat.basis[0], splat.basis[1], splat.basis[2], splat.basis[3]]);
            basisDataMap.set(basisData);
            basisUpdateBuffer.unmap();

            commandEncoder.copyBufferToBuffer(basisUpdateBuffer, 0, this._basisBuffer, 0, 4 * Float32Array.BYTES_PER_ELEMENT * this._splats.length);
            return basisUpdateBuffer;
        }
      
        public render(renderPass: GPURenderPassEncoder, viewParamsBindGroup: GPUBindGroup) {
          renderPass.setPipeline(this._pipeline);
          renderPass.setBindGroup(0, viewParamsBindGroup);
          renderPass.setBindGroup(1, this._splatBindGroup);
          renderPass.setVertexBuffer(0, this._splatPositionBuffer);
          renderPass.setVertexBuffer(1, this._splatIdsBuffer);
          for (let i = this._numVertices - 1; i >= 0; i--) {
            renderPass.draw(4, 1, 0, i);
          }
        }
}