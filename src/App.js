import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import ReactPerspCrop from './ReactPerspCrop';

import img from './sample.jpg';

class App extends Component {

    state = {
        cropped: null,
    }

    handleCrop = (image) => {
        let url = URL.createObjectURL(image);
        console.log(url);
        this.setState({ cropped: url});
    }

    render() {
        return (
            <div className="App">
                <ReactPerspCrop src={img} style={{height: 700, width: 800}} outputWidth={300} outputHeight={200} onCrop={this.handleCrop}/>

                <img src={this.state.cropped}/>
            </div>
        );
    }
}

export default App;
