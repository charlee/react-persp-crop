import React from 'react';
import math from 'mathjs';
import dlt from 'dltjs';
import PropTypes from 'prop-types';

import './ReactPerspCrop.css';


class ImageDataContainer {

    /**
     * Init a container with the reuslt of context.getImageData()
     * @param {ImageData} imageData 
     */
    constructor(imageData) {
        this.imageData = imageData;
    }

    getColor(x, y) {
        let idx = (y * this.imageData.width + x) * 4;
        return Array.from(this.imageData.data.slice(idx, idx + 4));
    }

    setColor(x, y, color) {
        let idx = (y * this.imageData.width + x) * 4;
        for (let i = 0; i < 4; i++) {
            this.imageData.data[idx + i] = color[i];
        }
    }

    /**
     * Interpolate color for point (x, y).
     * @param {float} x 
     * @param {float} y 
     */
    interpolate(x, y) {
        let x1 = parseInt(x);
        let y1 = parseInt(y);
        let x2 = x1 + 1;
        let y2 = y1 + 1;
        let dx = x - x1;
        let dy = y - y1;

        let q11 = this.getColor(x1, y1);
        let q21 = this.getColor(x2, y1);
        let q12 = this.getColor(x1, y2);
        let q22 = this.getColor(x2, y2);

        let r1 = math.add(math.multiply(q11, 1 - dx), math.multiply(q21, dx));
        let r2 = math.add(math.multiply(q12, 1 - dx), math.multiply(q22, dx));

        let r = math.add(math.multiply(r1, 1 - dy), math.multiply(r2, dy));

        return r;
    }
}


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
        img: [0, 0],
        zoomLevel: 0,
        polygon: [0, 0],
        handle0: [20, 20],
        handle1: [100, 20],
        handle2: [100, 100],
        handle3: [20, 100],
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

        return [
            (rect.top + window.pageYOffset) - doc.clientTop,
            (rect.left + window.pageXOffset) - doc.clientLeft,
        ];
    }

    /**
     * Return the client pos for given event.
     * @param {Event} e 
     */
    getClientPos(e) {
        return [
            e.touches ? e.touches[0].clientX : e.clientX,
            e.touches ? e.touches[0].clientY : e.clientY,
        ]
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
        pos = math.subtract(pos, offset);

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
        ps = ps.map(p => math.add(p, img, polygon));

        let intersectionCount = 0;

        for (let i = 0; i < 4; i++) {
            const p1 = ps[i];
            const p2 = ps[i === 3 ? 0 : i + 1];

            let t = (pos[1] - p1[1]) / (p2[1] - p1[1]);
            let x = p1[0] + (p2[0] - p1[0]) * t;
            if (x > pos[0] && t >= 0 && t < 1) {
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

    onMouseTouchMove = (e) => {
        if (this.state.dragging) {
            const clientPos = this.getClientPos(e);
            this.setState((prevState, props) => {
                const name = prevState.dragStartObj;

                if (name !== null) {
                    return {
                        [name]: math.subtract(math.add(prevState.dragStartObjPos, clientPos), prevState.dragStartEventPos),
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
        p0 = p0.map(p => math.add(p, polygon));

        let p1 = [
            [ 0, 0 ],
            [ outputWidth, 0 ],
            [ outputWidth, outputHeight ],
            [ 0, outputHeight ],
        ];

        let M = dlt.dlt2d(p0, p1);
        M = math.inv(M);
        M = math.divide(M, M[2][2]);

        // draw cropped image
        const canvas = document.createElement('canvas');
        canvas.width = this.objRefs.img.width;
        canvas.height = this.objRefs.img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.objRefs.img, 0, 0);

        const image = new ImageDataContainer(ctx.getImageData(0, 0, this.objRefs.img.width, this.objRefs.img.height));
        const convertedImage = new ImageDataContainer(ctx.createImageData(outputWidth, outputHeight));

        for (let x = 0; x < outputWidth; x++) {
            for (let y = 0; y < outputHeight; y++) {

                // p is the coordinate in the source image
                let p = dlt.transform2d(M, [x, y]);

                // Interpolate the color for point p
                let color = image.interpolate(p[0], p[1]);

                convertedImage.setColor(x, y, color);
            }
        }

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outputCtx = outputCanvas.getContext('2d');
        outputCtx.putImageData(convertedImage.imageData, 0, 0);

        outputCanvas.toBlob((file) => {
            this.props.onCrop(file);
        });
    }

    getPolygonPoints() {
        const { img, polygon, handle0, handle1, handle2, handle3 } = this.state;
        let points = [handle0, handle1, handle2, handle3];
        points = points.map(p => math.add(img, polygon, p, [6, 6]));

        return points.map(p => p.join(',')).join(' ');
    }

    render() {
        const { src } = this.props;
        const { img, polygon, handle0, handle1, handle2, handle3 } = this.state;

        let handles = [handle0, handle1, handle2, handle3];
        handles = handles.map(p => math.add(img, polygon, p));
        

        return (
            <div className={`ReactPerspCrop-root ${this.props.className}`} ref={(n) => { this.containerRef = n; }}
                onTouchStart={this.onMouseTouchDown}
                onMouseDown={this.onMouseTouchDown}
                onWheel={this.onWheel}
                style={this.props.style}
            >
                <img src={src} alt="PerspCropper" className="ReactPerspCrop-img"
                    style={{ left: img[0], top: img[1] }}
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


                <div className="ReactPerspCrop-handle" style={{ left: handles[0][0], top: handles[0][1] }}
                    ref={this.registerRef('handle0')} />
                <div className="ReactPerspCrop-handle" style={{ left: handles[1][0], top: handles[1][1] }}
                    ref={this.registerRef('handle1')} />
                <div className="ReactPerspCrop-handle" style={{ left: handles[2][0], top: handles[2][1] }}
                    ref={this.registerRef('handle2')} />
                <div className="ReactPerspCrop-handle" style={{ left: handles[3][0], top: handles[3][1] }}
                    ref={this.registerRef('handle3')} />

                <button className="ReactPerspCrop-overlay-button" onClick={this.handleCrop}>Crop</button>
            </div>
        );
    }

}


export default ReactPerspCrop;