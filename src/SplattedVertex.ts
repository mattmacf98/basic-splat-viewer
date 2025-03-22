import * as glMatrix from 'gl-matrix';

export class SplattedVertex {
    private _position: glMatrix.vec3;
    private _rotation: glMatrix.vec4;
    private _scale: glMatrix.vec3;
    private _color: glMatrix.vec3;
    private _opacity: number;
    private _covariance: glMatrix.mat3;
    private _basis: glMatrix.vec4;

    constructor(position: glMatrix.vec3, rotation: glMatrix.vec4, scale: glMatrix.vec3, color: glMatrix.vec3, opacity: number) {
        this._position = position;
        this._rotation = rotation;
        this._scale = scale;
        this._color = color;
        this._opacity = opacity;

        // GET COVARIANCE
        const rot_quat = glMatrix.quat.fromValues(this._rotation[1], this._rotation[2], this._rotation[3], this._rotation[0]);
        glMatrix.quat.normalize(rot_quat, rot_quat);
        const rot_mat3 = glMatrix.mat3.fromQuat(glMatrix.mat3.create(), rot_quat);
        const scale_mat4 = glMatrix.mat4.fromScaling(glMatrix.mat4.create(), this._scale);
        const scale_mat3 = glMatrix.mat3.fromMat4(glMatrix.mat3.create(), scale_mat4);

        const T = glMatrix.mat3.multiply(glMatrix.mat3.create(), rot_mat3, scale_mat3);
        const T_transpose = glMatrix.mat3.transpose(glMatrix.mat3.create(), T);
        const covariance = glMatrix.mat3.multiply(glMatrix.mat3.create(), T, T_transpose);

        this._covariance = covariance;
        this._basis = glMatrix.vec4.fromValues(1, -1, 1, 1);
    }

    public updateBasis(projectionMatrix: glMatrix.mat4, modelViewMatrix: glMatrix.mat4, canvas: HTMLCanvasElement) {
        const renderDimension = { x: canvas.clientWidth, y: canvas.clientHeight };
        const focal = {
            x: projectionMatrix[0] * renderDimension.x * 0.5,
            y: projectionMatrix[5] * renderDimension.y * 0.5
        }

        // 0.8904313445091248 1.187241792678833
        // const mvm: glMatrix.mat4 = glMatrix.mat4.fromValues(-1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,-1,1)

        const viewCenter = glMatrix.vec4.transformMat4(glMatrix.vec4.create(), glMatrix.vec4.fromValues(this._position[0], this._position[1], this._position[2], 1.0), modelViewMatrix);
        const s = 1.0 / (viewCenter[2] * viewCenter[2]);
        const jacobian = glMatrix.mat3.fromValues(
            focal.x / viewCenter[2], 0, -(focal.x * viewCenter[0]) * s,
            0, focal.y / viewCenter[2], -(focal.y * viewCenter[1]) * s,
            0, 0, 0
        );

        const W = glMatrix.mat3.transpose(glMatrix.mat3.create(), glMatrix.mat3.fromMat4(glMatrix.mat3.create(), modelViewMatrix));
        const T = glMatrix.mat3.multiply(glMatrix.mat3.create(), W, jacobian);

        const newC = glMatrix.mat3.multiply(glMatrix.mat3.create(), glMatrix.mat3.transpose(glMatrix.mat3.create(), T), glMatrix.mat3.multiply(glMatrix.mat3.create(), this._covariance, T));
        const cov2Dv = glMatrix.vec3.fromValues(newC[0], newC[1], newC[4]);

        const a = cov2Dv[0];
        const b = cov2Dv[1];
        const d = cov2Dv[2];

        const D = a * d - b * b;
        const trace = a + d;
        const traceOver2 = trace / 2;
        const term2 = Math.sqrt(trace * trace / 4.0 - D);
        const eigen1 = traceOver2 + term2;
        const eigen2 = Math.max(traceOver2 - term2, 0);

        const maxSplatRadius = 1024;
        const eigenVector1 = glMatrix.vec2.normalize(glMatrix.vec2.create(), glMatrix.vec2.fromValues(b, eigen1 - a));
        const eigenVector2 = glMatrix.vec2.fromValues(eigenVector1[1], -eigenVector1[0]);

        const basisVector1 = glMatrix.vec2.scale(glMatrix.vec2.create(), eigenVector1, Math.min(Math.sqrt(eigen1) * 4, maxSplatRadius));
        const basisVector2 = glMatrix.vec2.scale(glMatrix.vec2.create(), eigenVector2, Math.min(Math.sqrt(eigen2) * 4, maxSplatRadius));

       this._basis = glMatrix.vec4.fromValues(basisVector1[0], basisVector1[1], basisVector2[0], basisVector2[1]);
    }

    public get basis() {
        return this._basis;
    }

    get position() {
        return this._position;
    }

    get rotation() {
        return this._rotation;
    }

    get scale() {
        return this._scale;
    }

    get color() {
        return this._color;
    }

    get opacity() {
        return this._opacity;
    }

    get covariance() {
        return this._covariance;
    }
}