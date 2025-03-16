import { ArcballCamera } from "arcball_camera";
import { Controller } from "ez_canvas_controller";
import * as glMatrix from "gl-matrix";
import { PlyParser } from "./PlyParser";
import { Points } from "./Points";

export class RenderEngine {
    public static async init(canvas: HTMLCanvasElement) {
     // 1. INITIALIZE GPU CONTEXT
      if (navigator.gpu == null) {
        throw new Error('WebGPU not supported on this browser.');
      }
  
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter == null) {
        throw new Error('Failed to request GPU adapter.');
      }
  
      const device = await adapter.requestDevice();
      if (device == null) {
        throw new Error('Failed to request GPU device.');
      }
  
      const context = canvas.getContext('webgpu');
      if (context == null) {
        throw new Error('Failed to request GPU context.');
      }
  
      context.configure({
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      })
  
      // 2. CREATE VIEW Bind Group
      const viewParamBindGroupLayout = device?.createBindGroupLayout({
        entries: [{
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {type: 'uniform'},
        }],
      });
      const viewParamBuffer = device?.createBuffer({
        size: 16 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const viewParamBindGroup = device?.createBindGroup({
        layout: viewParamBindGroupLayout,
        entries: [{
          binding: 0,
          resource: {buffer: viewParamBuffer},
        }],
      });
  
      // 3. LOAD PLY FILE
      const response = await fetch('/food.ply')
      const blob = await response.blob()
      const file = new File([blob], 'food.ply')
      
      const parser = new PlyParser()
      await parser.parsePlyFile(file)
  
      const points = new Points(device, parser.getSplattifiedVertices(), viewParamBindGroupLayout)
  
      // 4. CREATE CAMERA AND CONTROLLER
      const camera = new ArcballCamera([0, 0, 1], [0, 0, 0], [0, 1, 0], 0.5, [
        canvas.width,
        canvas.height,
      ]);
  
      const projection = glMatrix.mat4.perspective(
          glMatrix.mat4.create(),
          1.4,
          canvas.width / canvas.height,
          0.1,
          1000
      );
      let projView = glMatrix.mat4.create();
  
      const controller = new Controller();
  
      controller.mousemove = function (prev: any, cur: any, event: { buttons: number; }) {
          if (event.buttons == 1) {
              camera.rotate(prev, cur);
          } else if (event.buttons == 2) {
              camera.pan([cur[0] - prev[0], prev[1] - cur[1]])
          }
      }
      controller.wheel = function (amount: number) {
          camera.zoom(amount * 0.5);
      }
      controller.registerForCanvas(canvas);
  
      // 5. CREATE RENDER PASS AND FRAME LOOP
      const renderPassDesc: GPURenderPassDescriptor = {
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
            storeOp: "store"
        }]
      };
  
      const frame = function() {
        // 6. UPDATE VIEW PARAMETERS EACH FRAME USING CAMERA
        const viewParamUpdateBuffer = device.createBuffer({
          size: 16 * Float32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_SRC,
          mappedAtCreation: true
        });
        projView = glMatrix.mat4.mul(projView, projection, camera.camera);
        const map = new Float32Array(viewParamUpdateBuffer.getMappedRange());
        map.set(projView);
        viewParamUpdateBuffer.unmap();
        // Update the view in the render pass descriptor each frame
        (renderPassDesc.colorAttachments as GPURenderPassColorAttachment[])[0].view = context.getCurrentTexture().createView();

        // 7. CREATE COMMAND ENCODER AND RENDER PASS
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(viewParamUpdateBuffer, 0, viewParamBuffer, 0, 16 * Float32Array.BYTES_PER_ELEMENT);
        const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
        points.render(renderPass, viewParamBindGroup);
        renderPass.end();
  
        device.queue.submit([commandEncoder.finish()]);
        viewParamUpdateBuffer.destroy();
  
        requestAnimationFrame(frame);
      }
  
      requestAnimationFrame(frame)
    }
  }