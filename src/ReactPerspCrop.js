import React from 'react';
import math from 'mathjs';
import PropTypes from 'prop-types';

import './ReactPerspCrop.css';


const styles = {
    root: {
        maxWidth: 600,
        maxHeight: 400,
        minWidth: 400,
        minHeight: 300,
        overflow: 'hidden',
        border: 'solid 1px #ccc',
        position: 'relative',

        // checker board background to indicate transparent
        backgroundColor: '#fff',
        backgroundImage: [
            'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%, #ddd)',
            'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%, #ddd)',
        ],
        backgroundSize: '32px 32px',
        backgroundPosition: '0 0, 16px 16px',
        zIndex: 0,
    },

    img: {
        position: 'absolute',
        zIndex: 0,
    },

    handle: {
        position: 'absolute',
        width: 12,
        height: 12,
        background: '#eee',
        cursor: 'pointer',
        border: 'solid 1px #03f',
        zIndex: 20,
    },

    frame: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        zIndex: 10,
    }
};


class ReactPerspCrop extends React.PureComponent {
    static propTypes = {
        src: PropTypes.string.isRequired,
        onCrop: PropTypes.func.isRequired,
        outputWidth: PropTypes.number.isRequired,
        outputHeight: PropTypes.number.isRequired,
    }

    state = {
        dragStartEventPos: null,
        dragStartObj: null,
        dragStartObjPos: null,
        dragging: false,
        img: { x: 0, y: 0 },
        zoomLevel: 0,
        polygon: { x: 0, y: 0 },
        handle0: { x: 20, y: 20 },
        handle1: { x: 100, y: 20 },
        handle2: { x: 100, y: 100 },
        handle3: { x: 20, y: 100 },
        frameStyle: {},
    }

    constructor() {
        super();
        this.containerRef = null;
        this.objRefs = {};
        this.onWheelTimer = null;           // Debounce onwheel event
    }

    componentDidMount() {
        // Bound to document to ensure drag event continues when mouse moves out of the component
        document.addEventListener('mousemove', this.onMouseTouchMove);
        document.addEventListener('touchmove', this.onMouseTouchMove);
        document.addEventListener('mouseup', this.onMouseTouchUp);
        document.addEventListener('touchend', this.onMouseTouchUp);
        document.addEventListener('touchcancel', this.onMouseTouchUp);
    }

    getElementOffset(el) {
        const rect = el.getBoundingClientRect();
        const doc = document.documentElement;

        return {
            top: (rect.top + window.pageYOffset) - doc.clientTop,
            left: (rect.left + window.pageXOffset) - doc.clientLeft,
        };
    }

    /**
     * Return the client pos for given event.
     * @param {Event} e 
     */
    getClientPos(e) {
        return {
            x: e.touches ? e.touches[0].clientX : e.clientX,
            y: e.touches ? e.touches[0].clientY : e.clientY,
        }
    }

    /**
     * Find out which object is being dragged
     * @param {Event} e 
     */
    findDraggingObj(e) {
        const names = ['handle0', 'handle1', 'handle2', 'handle3'];
        for (let i in names) {
            if (this.objRefs[names[i]] === e.target) {
                return names[i];
            }
        }


        // If the handles are not clicked, then try to find out if the polygon is clicked
        let offset = this.getElementOffset(this.containerRef);
        let pos = this.getClientPos(e);
        pos.x -= offset.left;
        pos.y -= offset.top;

        if (this.isInPolygon(pos)) {
            return 'polygon';
        } else {
            return 'img';
        }
    }

    /**
     * Test if a point is inside the handle polygon
     */
    isInPolygon(pos) {
        const { img, polygon, handle0, handle1, handle2, handle3 } = this.state;
        let ps = [ handle0, handle1, handle2, handle3 ];
        ps = ps.map(p => ({ x: p.x + img.x + polygon.x, y: p.y + img.y + polygon.y }));

        let intersectionCount = 0;

        for (let i = 0; i < 4; i++) {
            const p1 = ps[i];
            const p2 = ps[i === 3 ? 0 : i + 1];

            let t = (pos.y - p1.y) / (p2.y - p1.y);
            let x = p1.x + (p2.x - p1.x) * t;
            if (x > pos.x && t >= 0 && t < 1) {
                intersectionCount++;
            }
        }

        return (intersectionCount % 2 === 1);
    }

    onMouseTouchDown = (e) => {

        let name = this.findDraggingObj(e);
        if (name) {
            const clientPos = this.getClientPos(e);
            this.setState((prevState, props) => ({
                dragging: true,
                dragStartEventPos: clientPos,
                dragStartObjPos: prevState[name],
                dragStartObj: name,
            }));

        }

        e.preventDefault();
    }

    onMouseTouchUp = (e) => {
        this.setState({
            dragging: false,
            dragStartEventPos: null,
            dragStartObjPos: null,
            dragStartObj: null,
        });
        e.preventDefault();
    }

    onWheel = (e) => {
        if (!this.onWheelTimer) {
            window.clearTimeout(this.onWheelTimer);

            let delta = -Math.sign(e.deltaY);
            this.setState((prevState, props) => ({ zoomLevel: prevState.zoomLevel + delta }));

            // disable wheel event for 200ms
            this.onWheelTimer = window.setTimeout(() => {
                this.onWheelTimer =null;
            }, 200);
        }
    }

    computeAffineMatrix(p0, p1) {
        let A = [], B = [];
        for (let i = 0; i < 4; i++) {
            let x = p0[i].x;
            let y = p0[i].y;
            let u = p1[i].x;
            let v = p1[i].y;

            A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
            A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
            B.push(u);
            B.push(v);
        }

        return math.lusolve(A, B);
    }

    onMouseTouchMove = (e) => {
        if (this.state.dragging) {
            const clientPos = this.getClientPos(e);
            this.setState((prevState, props) => {
                const name = prevState.dragStartObj;

                if (name !== null) {
                    return {
                        [name]: {
                            x: prevState.dragStartObjPos.x + (clientPos.x - prevState.dragStartEventPos.x),
                            y: prevState.dragStartObjPos.y + (clientPos.y - prevState.dragStartEventPos.y),
                        }
                    };

                } else {
                    return {};
                }
            });
        }
        e.preventDefault();
    }

    registerRef = (name) => (n) => {
        this.objRefs[name] = n;
    }

    handleCrop = () => {
        const { outputWidth, outputHeight } = this.props;
        const { polygon, handle0, handle1, handle2, handle3 } = this.state;

        // Crop the image
        let p0 = [handle0, handle1, handle2, handle3];
        p0 = p0.map(p => ({ x: p.x + polygon.x, y: p.y + polygon.y }));

        let p1 = [
            { x: 0, y: 0 },
            { x: outputWidth, y: 0 },
            { x: outputWidth, y: outputHeight },
            { x: 0, y: outputHeight },
        ];

        let H = this.computeAffineMatrix(p0, p1);
        H.push(1);
        H = math.reshape(H, [3, 3]);

        let M = math.inv(H);
        M = math.divide(M, M[2][2]);

        // draw cropped image
        const canvas = document.createElement('canvas');
        canvas.width = this.objRefs.img.width;
        canvas.height = this.objRefs.img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.objRefs.img, 0, 0);

        const imageData = ctx.getImageData(0, 0, this.objRefs.img.width, this.objRefs.img.height);
        const convertedImage = ctx.createImageData(outputWidth, outputHeight);

        for (let x = 0; x < outputWidth; x++) {
            for (let y = 0; y < outputHeight; y++) {
                let p = math.multiply(M, [x, y, 1]);
                p = math.divide(p, p[2]);
                let src = (parseInt(p[1]) * imageData.width + parseInt(p[0])) * 4;
                let target = (y * outputWidth + x) * 4;
                for (let i = 0; i < 4; i++) {
                    convertedImage.data[target + i] = imageData.data[src + i];
                }
            }
        }

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outputCtx = outputCanvas.getContext('2d');
        outputCtx.putImageData(convertedImage, 0, 0);

        outputCanvas.toBlob((file) => {
            this.props.onCrop(file);
        });
    }

    getPolygonPoints() {
        const { img, polygon, handle0, handle1, handle2, handle3 } = this.state;
        const x = img.x + polygon.x;
        const y = img.y + polygon.y;
        return `${x+handle0.x+6},${y+handle0.y+6} ${x+handle1.x+6},${y+handle1.y+6} ${x+handle2.x+6},${y+handle2.y+6} ${x+handle3.x+6},${y+handle3.y+6}`;
    }

    render() {
        const { src } = this.props;
        const { img, polygon, handle0, handle1, handle2, handle3 } = this.state;

        return (
            <div className={`ReactPerspCrop-root ${this.props.className}`} ref={(n) => { this.containerRef = n; }}
                onTouchStart={this.onMouseTouchDown}
                onMouseDown={this.onMouseTouchDown}
                onWheel={this.onWheel}
                style={this.props.style}
            >
                <img src={src} alt="PerspCropper" className="ReactPerspCrop-img"
                    style={{ left: img.x, top: img.y }}
                    ref={this.registerRef('img')}
                />

                <svg width="100%" height="100%" className="ReactPerspCrop-frame">
                    <defs>
                        <mask id="mask-1">
                            <rect width="100%" height="100%" x={0} y={0} fill="#555"/>
                            <polygon points={this.getPolygonPoints()} fill="#000" />
                        </mask>
                    </defs>
                    <rect width="100%" height="100%" x={0} y={0} fill="#000" mask="url(#mask-1)" />
                    <polygon points={this.getPolygonPoints()} fill="none" stroke="#03f" strokeWidth="2" strokeDasharray="5,5"/>
                </svg>


                <div className="ReactPerspCrop-handle" style={{ left: img.x + polygon.x + handle0.x, top: img.y + polygon.y + handle0.y }}
                    ref={this.registerRef('handle0')} />
                <div className="ReactPerspCrop-handle" style={{ left: img.x + polygon.x + handle1.x, top: img.y + polygon.y + handle1.y }}
                    ref={this.registerRef('handle1')} />
                <div className="ReactPerspCrop-handle" style={{ left: img.x + polygon.x + handle2.x, top: img.y + polygon.y + handle2.y }}
                    ref={this.registerRef('handle2')} />
                <div className="ReactPerspCrop-handle" style={{ left: img.x + polygon.x + handle3.x, top: img.y + polygon.y + handle3.y }}
                    ref={this.registerRef('handle3')} />

                <button className="ReactPerspCrop-overlay-button" onClick={this.handleCrop}>Crop</button>
            </div>
        );
    }

}


export default ReactPerspCrop;