import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import ReactPerspCrop from './ReactPerspCrop';

import img from './sample.jpg';

class App extends Component {
  render() {
    return (
      <div className="App">

        <ReactPerspCrop src={img} style={{height: 600, width: 800}}/>
      </div>
    );
  }
}

export default App;
