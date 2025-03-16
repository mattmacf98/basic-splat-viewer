/// <reference types="vite/client" />
/// <reference types="@webgpu/types" />


declare module "ez_canvas_controller";

declare module "arcball_camera" {
    export class ArcballCamera {
      camera: any;
      zoom(arg0: number): void
      pan(arg0: number[]): void
      rotate(prev: any, cur: any): void
      constructor(
        eye: [number, number, number], // e.g. [0, 0, 3]
        target: [number, number, number], // e.g. [0, 0, 0]
        up: [number, number, number], // e.g. [0, 1, 0]
        zoom: number, // e.g. 0.5
        viewport: [number, number] // e.g. [canvas.width, canvas.height]
      );
  
      // You can add additional methods or properties of ArcballCamera here, if needed
    }
}

declare module "*.wgsl"
{
    const content: string;
    export default content;
}