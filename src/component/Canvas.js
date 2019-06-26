// @flow

import React from 'react';

import { 
    connect 
}   from 'react-redux';

import Vector1x4 from '../math/Vector1x4.js';
import RefFrame from '../math/RefFrame.js';

import SampleShader from '../shader/SampleShader.js';
import CanvasShader from '../shader/CanvasShader.js';
import Scene from '../scene/Scene.js';

import {
    reduxStore
}   from '../redux/reducers.js';

export const canvasWd = 800;
export const canvasHt = 600;
export let GL = null;

export const rootNode = new RefFrame(null);
export const parentNode = new RefFrame(rootNode);
export const cameraNode = new RefFrame(parentNode);
cameraNode.translate(new Vector1x4(0.0, -5.0, 0.0));

class Canvas extends React.Component {
    constructor(props) {
        super(props);

        this.TXYZ_SCALAR = 0.01;
        this.RXYZ_SCALAR = 0.25;
        this.lButtonDown = false;
        this.rButtonDown = false;
        this.lx = 0;
        this.ly = 0;

        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);

        this.sampleShader = null;
        this.canvasShader = null;
        this.bRendering = false;
        this.renderPass = 0;
    }

    render() {
        return <canvas id='Canvas' width={canvasWd} height={canvasHt}>
            Please use a browser that supports WebGL 2
        </canvas>
    }

    restartRendering() {
        if (this.bRendering) {
            this.renderPass = 0;
        } else {
            this.renderPass = 0;
            this.bRendering = true;
            this.executeRenderingPass();
        }
    }

    executeRenderingPass() {
        requestAnimationFrame(() => {
            if (this.renderPass < reduxStore.getState().numSamples) {
                this.renderPass++;
                this.sampleShader.draw(this.renderPass, cameraNode.modelMatrix);
                this.canvasShader.draw(this.renderPass, this.sampleShader.colorCache);
                this.executeRenderingPass();
            } else {
                this.bRendering = false;
            }
        });
    }

    reportStats() {
        console.log(`MAX_UNIFORM_BUFFER_BINDINGS=${GL.getParameter(GL.MAX_UNIFORM_BUFFER_BINDINGS)}`);
        console.log(`MAX_FRAGMENT_UNIFORM_BLOCKS=${GL.getParameter(GL.MAX_FRAGMENT_UNIFORM_BLOCKS)}`);
        console.log(`MAX_UNIFORM_BLOCK_SIZE=${GL.getParameter(GL.MAX_UNIFORM_BLOCK_SIZE)}`);
    }

    componentDidMount() {
        this.canvas = document.getElementById('Canvas');
        GL = this.canvas.getContext('webgl2', {
            depth: false,
            alpha: false,
        });

        if (GL) {
            if (!GL.getExtension("EXT_color_buffer_float")) {
                console.error("FLOAT color buffer not available");
            }
            this.reportStats();

            this.canvas.oncontextmenu = event => event.preventDefault(); // disable right click context menu
            this.canvas.onmousedown = this.onMouseDown;
            window.onmousemove = this.onMouseMove;
            window.onmouseup = this.onMouseUp;

            this.scene = new Scene('/webgl.obj');
            this.sampleShader = new SampleShader(this.scene, canvasWd, canvasHt);
            this.canvasShader = new CanvasShader();

            this.scene.init()
                .then(() => this.sampleShader.init('/sample-vs.glsl', '/sample-fs.glsl'))
                .then(() => this.canvasShader.init('/canvas-vs.glsl', '/canvas-fs.glsl'))
                .then(() => this.restartRendering());
        }
    }

    shouldComponentUpdate() {
        this.restartRendering();
        return false;
    }

    degreesToRadians(degrees) {
        return degrees * Math.PI / 180.0;
    }

    onMouseUp(event) {
        switch (event.button) {
        case 0: this.lButtonDown = false; break;
        case 2: this.rButtonDown = false; break;
        default: break;
        }
    }

    onMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
            switch (event.button) {
            case 0: this.lButtonDown = true; break;
            case 2: this.rButtonDown = true; break;
            default: break;
            }
            this.lx = x;
            this.ly = y;
        }
    }

    onMouseMove(event) {
        if (this.lButtonDown || 
            this.rButtonDown) {

            const x = event.clientX;
            const y = event.clientY;

            if ((this.lButtonDown && this.rButtonDown) || (this.lButtonDown && event.shiftKey)) { // dolly
                if (x !== this.lx) {
                    cameraNode.translate(new Vector1x4(0, (x - this.lx) * this.TXYZ_SCALAR, 0));
                    this.lx = x;
                    this.ly = y;
                    this.restartRendering();
                }
            } else if ((this.lButtonDown && event.ctrlKey) || this.rButtonDown) { // move
                if (x !== this.lx || y !== this.ly) {
                    const dx = (this.lx - x) * this.TXYZ_SCALAR;
                    const dz = (y - this.ly) * this.TXYZ_SCALAR;
                    const dv = cameraNode.mapPos(new Vector1x4(dx, 0, dz, 0), parentNode);
                    parentNode.translate(dv) // move parent in camera space
                    this.lx = x;
                    this.ly = y;
                    this.restartRendering();
                }
            } else if (this.lButtonDown) { // rotate
                if (x !== this.lx || y !== this.ly) {
                    parentNode.rotateZ(this.degreesToRadians(this.lx - x) * this.RXYZ_SCALAR); // yaw camera target around it's own z-axis
                    cameraNode.rotateX(this.degreesToRadians(this.ly - y) * this.RXYZ_SCALAR, parentNode); // pitch around camera's parent x-axis
                    this.lx = x;
                    this.ly = y;
                    this.restartRendering();
                }
            }
        }
    }
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov:  state.cameraFov,
    };
}

// triggers Canvas.shouldComponentUpdate() when redux state changes
export default connect(mapStateToProps, null)(Canvas); 
