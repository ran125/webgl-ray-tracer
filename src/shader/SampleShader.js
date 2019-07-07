// @flow

import {
    reduxStore
}   from '../redux/reducers.js';

import SceneTextures from '../texture/SceneTextures.js';
import ColorTexture from '../texture/ColorTexture.js';
import NoiseTexture from '../texture/NoiseTexture.js';
import Matrix4x4 from '../math/Matrix4x4.js'
import Vector1x4 from '../math/Vector1x4.js'
import Shader from './Shader.js';

export default class SampleShader extends Shader {
    sceneTextures: SceneTextures;
    colorTexture: ColorTexture;
    noiseTexture: NoiseTexture;
    wd: number;
    ht: number;
    frameBuffer: WebGLFramebuffer;

    constructor(GL: any,
                sceneTextures: SceneTextures,
                colorTexture: ColorTexture,
                noiseTexture: NoiseTexture,
                wd: number,
                ht: number) {
        super();

        this.sceneTextures = sceneTextures;
        this.colorTexture = colorTexture;
        this.noiseTexture = noiseTexture;
        this.wd = wd;
        this.ht = ht;

        this.frameBuffer = GL.createFramebuffer();
        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.drawBuffers([ GL.COLOR_ATTACHMENT0 ]);
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    }

    draw(GL: any, renderPass: number, invViewMatrix: Matrix4x4) {
        const {
            numBounces,
            cameraFov,
            shading,
        } = reduxStore.getState();

        const origin = new Vector1x4(0.0, 0.0, 0.0); // in view space
        const eyePos = origin.mul(invViewMatrix); // in world space

        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.useProgram(this.program);
        GL.bindVertexArray(this.va);

        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.wd * 0.5);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.ht * 0.5);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_objects'), this.sceneTextures.objCount);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_render_pass'), renderPass);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_bounces'), numBounces);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_shading'), shading);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_eye_to_image'), (this.ht * 0.5) / (Math.tan(cameraFov * 0.5 * (Math.PI / 180.0))));
        GL.uniform3f(GL.getUniformLocation(this.program, 'u_eye_position'), eyePos.x, eyePos.y, eyePos.z);
        GL.uniformMatrix4fv(GL.getUniformLocation(this.program, 'u_eye_to_world'), false, invViewMatrix.toFloat32Array());

        this.sceneTextures.bindToSampleShader(GL, this.program);
        this.colorTexture.bindToSampleShader(GL, this.program);
        this.noiseTexture.bindToSampleShader(GL, this.program);
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
