@group(0) @binding(0)
var<uniform> projection: mat4x4<f32>;

@group(0) @binding(1)
var<uniform> modelView: mat4x4<f32>;

@group(0) @binding(2)
var<uniform> screen_size: vec2<f32>;

@group(1) @binding(0)  
var<storage, read> inCentroids:array<vec3<f32>>;

@group(1) @binding(1)  
var<storage, read> inBasis :array<vec4<f32>>;

@group(1) @binding(2) 
var<storage, read> inColors :array<vec4<f32>>;


struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) coord: vec2<f32>,
    @location(1) color: vec4<f32>,
};

@vertex
fn vs_main(@location(0) inPos: vec2<f32>, @location(1) inId: u32) -> VertexOutput {
    var out: VertexOutput;
    
    var clipCenter: vec4<f32> = projection * modelView * vec4<f32>(inCentroids[inId], 1.0);
    var ndcCenter: vec3<f32> = clipCenter.xyz / clipCenter.w;
    var basisViewport: vec2<f32> = vec2<f32>(2.0/screen_size.x, 2.0/screen_size.y);
    var ndcOffset: vec2<f32> = vec2(inPos.x * inBasis[inId].xy + inPos.y * inBasis[inId].zw) * basisViewport;

    out.coord = inPos;
    out.color = inColors[inId];
    out.clip_position = vec4<f32>(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    var A = -dot(in.coord * 2.0, in.coord * 2.0);
    if (A  < -4.0) {
        discard;
    }
    var a = 1.0/(0.25 * sqrt(2.0*3.14))*exp(-0.5 * (in.coord.x*in.coord.x+in.coord.y*in.coord.y)/(0.25*0.25));
    return vec4<f32>(in.color.rgb, in.color.a * a);
}