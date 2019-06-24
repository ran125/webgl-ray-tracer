// @flow

export default class ColorCache {
    source: WebGLTexture;
    target: WebGLTexture;

    constructor(GL: WebGL2RenderingContext, wd: number, ht: number) {
        GL.activeTexture(GL.TEXTURE0);

        this.source = GL.createTexture();
        GL.bindTexture(GL.TEXTURE_2D, this.source);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texStorage2D(GL.TEXTURE_2D, 1, GL.RGBA32F, wd, ht);

        this.target = GL.createTexture();
        GL.bindTexture(GL.TEXTURE_2D, this.target);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texStorage2D(GL.TEXTURE_2D, 1, GL.RGBA32F, wd, ht);
    }

    bindToSampleShader(GL: WebGL2RenderingContext, program: WebGLProgram) {
        const textureSwap = this.source;
        this.source = this.target;
        this.target = textureSwap;

        // using texture unit 0
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.target);
        GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.target, 0);

        // using texture unit 1
        GL.activeTexture(GL.TEXTURE1);
        GL.bindTexture(GL.TEXTURE_2D, this.source);
        GL.uniform1i(GL.getUniformLocation(program, 'u_colorCache'), 1);
    }
    
    bindToCanvasShader(GL: WebGL2RenderingContext, program: WebGLProgram) {
        // using texture unit 0
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.target);
        GL.uniform1i(GL.getUniformLocation(program, 'u_colorCache'), 0);
    }
}