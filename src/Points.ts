import point_shader from "./shaders/point_shader.wgsl?raw";

export class Points {
    private _pipeline: GPURenderPipeline;
    private _positions: GPUBuffer;
    private _colors: GPUBuffer;
    private _opacities: GPUBuffer;
    private _numVertices: number;
  
    constructor(device: GPUDevice, vertices: any[], viewParamsBindGroupLayout: GPUBindGroupLayout) {
      const shaderModule = device.createShaderModule({
        code: point_shader
      });
  
      const positions = new Float32Array(vertices.flatMap(vertex => [vertex[0], vertex[1], vertex[2]]));
      const colors = new Float32Array(vertices.flatMap(_ => [0,1,0]));
      const opacities = new Float32Array(vertices.map(_ => 1));
  
      //CREATE VERTEX ATTRIBUTE BUFFERS
      const positionsBuffer = device.createBuffer({
        size: positions.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      });
      const positionsBufferView = new Float32Array(positionsBuffer.getMappedRange());
      positionsBufferView.set(positions);
      positionsBuffer.unmap();
  
      const colorsBuffer = device.createBuffer({
        size: colors.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      });
      const colorsBufferView = new Float32Array(colorsBuffer.getMappedRange());
      colorsBufferView.set(colors);
      colorsBuffer.unmap();
  
      const opacitiesBuffer = device.createBuffer({
        size: opacities.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      });
      const opacitiesBufferView = new Float32Array(opacitiesBuffer.getMappedRange());
      opacitiesBufferView.set(opacities);
      opacitiesBuffer.unmap();
  
      //CREATE VERTEX BUFFER LAYOUT
      const pointBufferLayout: GPUVertexBufferLayout = {
        attributes: [
          {
            shaderLocation: 0,
            format: 'float32x3',
            offset: 0
          }
        ],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
        stepMode: 'vertex'
      }
  
      const colorBufferLayout: GPUVertexBufferLayout = {
        attributes: [
          {
            shaderLocation: 1,
            format: 'float32x3',
            offset: 0
          }
        ],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
        stepMode: 'vertex'
      }
  
      const opacitiesBufferLayout: GPUVertexBufferLayout = {
        attributes: [
          {
            shaderLocation: 2,
            format: 'float32',
            offset: 0
          }
        ],
        arrayStride: Float32Array.BYTES_PER_ELEMENT,
        stepMode: 'vertex'
      }
  
      //CREATE PIPELINE
      const pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
          bindGroupLayouts:[viewParamsBindGroupLayout]
        }),
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [pointBufferLayout, colorBufferLayout, opacitiesBufferLayout]
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm' }]
        },
        primitive: {
          topology: 'point-list',
          frontFace: 'ccw',
          cullMode: 'none'
        }
      })
  
      this._pipeline = pipeline;
      this._positions = positionsBuffer;
      this._colors = colorsBuffer;
      this._opacities = opacitiesBuffer;
      this._numVertices = vertices.length;
    }
  
    public render(renderPass: GPURenderPassEncoder, viewParamsBindGroup: GPUBindGroup) {
      renderPass.setPipeline(this._pipeline);
      renderPass.setBindGroup(0, viewParamsBindGroup);
      renderPass.setVertexBuffer(0, this._positions);
      renderPass.setVertexBuffer(1, this._colors);
      renderPass.setVertexBuffer(2, this._opacities);
      renderPass.draw(this._numVertices, 1);
    }  
}