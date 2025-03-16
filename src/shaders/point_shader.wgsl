@group(0) @binding(0)
var<uniform> view_projection: mat4x4<f32>;

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
};
 
@vertex
fn vs_main(@location(0) inPos: vec3<f32>, @location(1) color: vec3<f32>, @location(2) opacity: f32) -> VertexOutput {
    var out: VertexOutput;
    out.color = vec4<f32>(color, opacity);
    out.clip_position = view_projection * vec4<f32>(inPos, 1.0);
    return out;
}
 
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return in.color;
}