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
    }

    state = {
        dragStartEventPos: null,
        dragStartObj: null,
        dragStartObjPos: null,
        dragging: false,
        img: { x: 0, y: 0 },
        zoomLevel: 0,
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
        return 'img';
    }

    onMouseTouchDown = (e) => {

        let name = this.findDraggingObj(e);
        console.log(name);
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
            let x = p0[i][0];
            let y = p0[i][1];
            let u = p1[i][0];
            let v = p1[i][1];

            A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
            A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
            B.push(u);
            B.push(v);
        }

        return math.multiply(math.inv(A), B);
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

    getPolygonPoints() {
        const { handle0, handle1, handle2, handle3 } = this.state;
        return `${handle0.x+6},${handle0.y+6} ${handle1.x+6},${handle1.y+6} ${handle2.x+6},${handle2.y+6} ${handle3.x+6},${handle3.y+6}`;
    }

    render() {
        const { src } = this.props;
        const { img, handle0, handle1, handle2, handle3 } = this.state;

        return (
            <div className="ReactPerspCrop-root" ref={(n) => { this.containerRef = n; }}
                onTouchStart={this.onMouseTouchDown}
                onMouseDown={this.onMouseTouchDown}
                onWheel={this.onWheel}
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


                <div className="ReactPerspCrop-handle" style={{ left: handle0.x, top: handle0.y }}
                    ref={this.registerRef('handle0')} />
                <div className="ReactPerspCrop-handle" style={{ left: handle1.x, top: handle1.y }}
                    ref={this.registerRef('handle1')} />
                <div className="ReactPerspCrop-handle" style={{ left: handle2.x, top: handle2.y }}
                    ref={this.registerRef('handle2')} />
                <div className="ReactPerspCrop-handle" style={{ left: handle3.x, top: handle3.y }}
                    ref={this.registerRef('handle3')} />
            </div>
        );
    }

}


export default ReactPerspCrop;